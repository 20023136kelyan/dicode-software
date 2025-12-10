import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Check,
  Lock,
  Clock,
  BookOpen,
  BarChart3,
  Trophy,
  Sparkles,
  ChevronRight,
  Award,
  Zap,
  MessageCircle,
  Flame,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCampaign,
  updateEnrollmentAccess,
  getVideo,
  getCampaignCompletionSummary
} from '@/lib/firestore';
import { useEnrollmentRealtime } from '@/hooks/useEnrollmentRealtime';
import { useUserStatsRealtime } from '@/hooks/useUserStats';
import { ProgressRing } from '@/components/mobile';
import type { Campaign, Video } from '@/types';

// Helper to check if completion celebration was already shown
const getCompletionShownKey = (campaignId: string, completedAt: string) =>
  `campaign_completion_shown_${campaignId}_${completedAt}`;

const wasCompletionShown = (campaignId: string, completedAt: string | undefined): boolean => {
  if (!completedAt) return false;
  const key = getCompletionShownKey(campaignId, completedAt);
  return localStorage.getItem(key) === 'true';
};

const markCompletionShown = (campaignId: string, completedAt: string | undefined) => {
  if (!completedAt) return;
  const key = getCompletionShownKey(campaignId, completedAt);
  localStorage.setItem(key, 'true');
};

// Helper to check if streak celebration was already shown today
const getStreakCelebrationTodayKey = () => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `streak_celebration_shown_${today}`;
};

const wasStreakCelebrationShownToday = (): boolean => {
  const key = getStreakCelebrationTodayKey();
  return localStorage.getItem(key) === 'true';
};

const markStreakCelebrationShownToday = () => {
  const key = getStreakCelebrationTodayKey();
  localStorage.setItem(key, 'true');
};

const CampaignDetails: React.FC = () => {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoMap, setVideoMap] = useState<Record<string, Video>>({});
  const [completionSummary, setCompletionSummary] = useState<any>(null);
  const [showReviewMode, setShowReviewMode] = useState(false);
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);

  // Update URL param when completion screen visibility changes
  useEffect(() => {
    if (showCompletionScreen || showStreakCelebration) {
      setSearchParams({ completion: 'true' }, { replace: true });
    } else {
      // Remove the completion param when hiding
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('completion');
      setSearchParams(newParams, { replace: true });
    }
  }, [showCompletionScreen, showStreakCelebration, setSearchParams]);

  // Real-time enrollment hook
  const { enrollment, isLoading: isLoadingEnrollment } = useEnrollmentRealtime(
    campaignId || '',
    user?.id || ''
  );

  // Get user streak stats
  const { stats: streakStats } = useUserStatsRealtime(user?.id || '');

  // Update enrollment access when enrollment is first loaded
  useEffect(() => {
    if (enrollment && campaignId && user?.id) {
      updateEnrollmentAccess(campaignId, user.id).catch((error) => {
        console.error('Failed to update enrollment access:', error);
      });
    }
  }, [enrollment?.id, campaignId, user?.id]);

  // Debug: Log enrollment updates to verify real-time listener is working
  useEffect(() => {
    if (enrollment) {
      console.log('Enrollment updated:', {
        completedModules: enrollment.completedModules,
        moduleProgressCount: Object.values(enrollment.moduleProgress || {}).filter(m => m.completed).length,
        status: enrollment.status,
        moduleProgress: enrollment.moduleProgress
      });
    }
  }, [enrollment?.completedModules, enrollment?.status, enrollment?.moduleProgress]);

  // Load completion summary when campaign is completed
  useEffect(() => {
    const loadCompletionSummary = async () => {
      if (!campaignId || !user?.id || !user?.organization) return;
      if (enrollment?.status !== 'completed') {
        setCompletionSummary(null);
        setShowCompletionScreen(false);
        return;
      }

      try {
        const summary = await getCampaignCompletionSummary(user.id, campaignId, user.organization);
        setCompletionSummary(summary);

        // Check if we should show the completion celebration (only once)
        const completedAt = summary?.completedAt || enrollment?.completedAt;
        const alreadyShown = wasCompletionShown(campaignId, completedAt);

        if (!alreadyShown) {
          // First time seeing this completion - show celebration
          setShowCompletionScreen(true);
          
          // Trigger confetti celebration
          confetti({
            particleCount: 200,
            spread: 100,
            origin: { y: 0.4 }
          });

          // Check if this completion contributed to streak (first of the day)
          // If streak is active and this was completed today, show streak celebration (only once per day)
          if (streakStats.currentStreak > 0 && !wasStreakCelebrationShownToday()) {
            const completedDate = new Date(completedAt);
            const today = new Date();
            const isToday = completedDate.toDateString() === today.toDateString();

            if (isToday) {
              setShowStreakCelebration(true);
              markStreakCelebrationShownToday();
            }
          }
        }
      } catch (error) {
        console.error('Failed to load completion summary:', error);
      }
    };

    loadCompletionSummary();
  }, [campaignId, user?.id, user?.organization, enrollment?.status, enrollment?.completedAt, streakStats.currentStreak]);

  // Load campaign and videos (separate from enrollment)
  useEffect(() => {
    const loadData = async () => {
      if (!campaignId) return;

      setIsLoading(true);
      try {
        const campaignData = await getCampaign(campaignId);
        setCampaign(campaignData);

        if (campaignData) {
          const uniqueVideoIds = Array.from(
            new Set((campaignData.items || []).map((item) => item.videoId).filter(Boolean))
          );
          const videos = await Promise.all(uniqueVideoIds.map((id) => getVideo(id)));
          const nextMap: Record<string, Video> = {};
          videos.forEach((video) => {
            if (video) {
              nextMap[video.id] = video;
            }
          });
          setVideoMap(nextMap);
        } else {
          setVideoMap({});
        }
      } catch (error) {
        console.error('Failed to load campaign details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [campaignId]);

  // Handle dismissing completion screen - must be before early returns
  const handleDismissCompletion = useCallback(() => {
    if (campaignId && completionSummary) {
      const completedAt = completionSummary.completedAt || enrollment?.completedAt;
      markCompletionShown(campaignId, completedAt);
    }
    setShowCompletionScreen(false);
    setShowStreakCelebration(false);
  }, [campaignId, completionSummary, enrollment?.completedAt]);

  const handleStart = () => {
    if (!campaign) return;
    navigate(`/employee/module/${campaign.id}`);
  };

  if (isLoading || isLoadingEnrollment) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        {/* Hero Skeleton */}
        <div className="relative min-h-[40vh] flex flex-col">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
          </div>

          {/* Header skeleton */}
          <div className="relative z-10 flex items-center justify-between p-4">
            <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
          </div>

          {/* Hero content skeleton */}
          <div className="relative z-10 flex-1 flex flex-col justify-end p-6 pb-8">
            <div className="h-8 w-3/4 bg-white/10 rounded-lg animate-pulse mb-3" />
            <div className="h-4 w-full bg-white/10 rounded animate-pulse mb-2" />
            <div className="h-4 w-2/3 bg-white/10 rounded animate-pulse mb-6" />
            <div className="flex gap-3">
              <div className="h-10 w-28 bg-black/40 rounded-full animate-pulse" />
              <div className="h-10 w-24 bg-black/40 rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        {/* Bottom sheet skeleton */}
        <div className="relative z-20 -mt-8 bg-black rounded-t-[32px] flex-1 px-6 pt-6">
          <div className="h-5 w-32 bg-white/10 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-6 h-6 rounded-full bg-white/10 animate-pulse" />
                <div className="flex-1 h-20 bg-[#1a1a1a] rounded-2xl animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Campaign Not Found</h1>
          <button onClick={() => navigate('/employee/home')} className="text-primary hover:underline">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // DiCode campaigns require explicit enrollment - no auto-enrollment allowed
  if (campaign.source === 'dicode' && !enrollment && !isLoadingEnrollment) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Access Required</h1>
          <p className="text-white/60 mb-4">You need to be enrolled in this campaign to access it.</p>
          <button onClick={() => navigate('/employee/home')} className="text-primary hover:underline">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const totalVideos = campaign.metadata?.computed?.totalItems ?? campaign.items.length;
  const minutesPerModule = 5;
  const moduleProgressMap = enrollment?.moduleProgress || {};
  const completedModules =
    enrollment?.completedModules ?? Object.values(moduleProgressMap).filter((m) => m.completed).length;

  // Calculate overall progress based on partial module progress (like desktop)
  const overallProgress = totalVideos === 0 ? 0 : Math.round(
    campaign.items.reduce((sum, item) => {
      const moduleState = moduleProgressMap[item.id];
      const videoMeta = videoMap[item.videoId];
      const questionCount = videoMeta?.questions?.length || 3;
      const questionTarget = moduleState?.questionTarget || questionCount;

      if (!moduleState) return sum;

      const progressRatio = ((moduleState.videoFinished ? 1 : 0) +
        Math.min(moduleState.questionsAnswered || 0, questionTarget)) /
        (questionTarget + 1);
      return sum + progressRatio;
    }, 0) / totalVideos * 100
  );
  const progress = Number.isNaN(overallProgress) ? 0 : overallProgress;
  const hasStarted =
    Object.keys(moduleProgressMap).length > 0 ||
    enrollment?.status === 'in-progress' ||
    enrollment?.status === 'completed';
  const isComplete = totalVideos > 0 && completedModules >= totalVideos;
  const firstIncompleteIndex = campaign.items.findIndex(
    (item) => !moduleProgressMap[item.id]?.completed
  );
  // Use pre-computed duration if available, otherwise calculate from video data
  const totalEstimatedMinutes = campaign.metadata?.computed?.estimatedMinutes ?? campaign.items.reduce((total, item) => {
    const video = videoMap[item.videoId];
    const questionCount = video?.questions ? video.questions.length : 3;
    const videoMinutes = video?.duration ? Math.ceil(video.duration / 60) : minutesPerModule;
    return total + videoMinutes + questionCount;
  }, 0);

  // Streak Celebration Modal
  const StreakCelebrationModal = () => {
    if (!showStreakCelebration) return null;

    const currentStreak = streakStats.currentStreak || 1;
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const streakDays = streakStats.streakDays || Array(7).fill(false).map((_, i) => i < currentStreak % 7);

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="w-full max-w-sm"
          >
            {/* Close button */}
            <button
              onClick={() => setShowStreakCelebration(false)}
              className="absolute top-4 right-4 p-2 text-white/50 hover:text-white"
            >
              <X size={24} />
            </button>

            {/* Flame Icon */}
            <div className="flex justify-center mb-4">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="relative"
              >
                <div className="w-32 h-32 rounded-full bg-gradient-to-b from-rose-500/30 to-transparent flex items-center justify-center">
                  <Flame size={80} className="text-rose-500 drop-shadow-[0_0_30px_rgba(244,63,94,0.5)]" />
                </div>
              </motion.div>
            </div>

            {/* Streak Count */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-2"
            >
              <h1 className="text-6xl font-bold text-white mb-1">{currentStreak}</h1>
              <p className="text-2xl font-semibold text-white">Day Streak</p>
              <p className="text-white/50 mt-1">You're on fire!</p>
            </motion.div>

            {/* Week Progress */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex justify-center gap-2 mt-6 mb-8"
            >
              {dayLabels.map((day, index) => {
                const isActive = streakDays[index];
                const isToday = index === new Date().getDay() - 1 || (new Date().getDay() === 0 && index === 6);

                return (
                  <div key={day} className="flex flex-col items-center gap-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-gradient-to-b from-rose-400 to-rose-600'
                          : 'bg-white/10'
                      } ${isToday ? 'ring-2 ring-rose-400 ring-offset-2 ring-offset-black' : ''}`}
                    >
                      {isActive ? (
                        <Check size={18} className="text-white" />
                      ) : (
                        <Flame size={16} className="text-white/30" />
                      )}
                    </div>
                    <span className="text-xs text-white/50">{day}</span>
                  </div>
                );
              })}
            </motion.div>

            {/* Recent Statistics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-[#1a1a1a] rounded-2xl p-4 mb-6"
            >
              <p className="text-white/50 text-sm text-center mb-3">Recent Statistics</p>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{currentStreak}</p>
                  <p className="text-xs text-white/40">Days</p>
                </div>
                <div className="text-center border-l border-white/10">
                  <p className="text-xl font-bold text-white">{completionSummary?.modulesCompleted || 0}</p>
                  <p className="text-xs text-white/40">Lessons</p>
                </div>
                <div className="text-center border-l border-white/10">
                  <p className="text-xl font-bold text-white">{completionSummary?.questionsAnswered || 0}</p>
                  <p className="text-xs text-white/40">Quizzes</p>
                </div>
                <div className="text-center border-l border-white/10">
                  <p className="text-xl font-bold text-white">{completionSummary?.xpEarned || 0}</p>
                  <p className="text-xs text-white/40">XP</p>
                </div>
              </div>
            </motion.div>

            {/* Continue Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              onClick={() => setShowStreakCelebration(false)}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold rounded-2xl"
            >
              Continue
            </motion.button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  // Render Completion Summary View (only on first view)
  if (isComplete && completionSummary && showCompletionScreen && !showReviewMode) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        {/* Streak Celebration Overlay */}
        <StreakCelebrationModal />

        {/* Close button */}
        <button
          onClick={handleDismissCompletion}
          className="absolute top-4 right-4 p-2 text-white/50 hover:text-white z-10"
        >
          <X size={24} />
        </button>

        {/* Completion Card */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm"
          >
            {/* Completed Checkmark Icon */}
            <div className="flex justify-center mb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="relative"
              >
                <div className="w-32 h-32 rounded-full bg-gradient-to-b from-green-500/30 to-transparent flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center drop-shadow-[0_0_30px_rgba(34,197,94,0.5)]">
                    <Check size={48} className="text-white" strokeWidth={3} />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* XP Earned - Big Number */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-2"
            >
              <h1 className="text-6xl font-bold text-white mb-1">+{completionSummary.xpEarned}</h1>
              <p className="text-2xl font-semibold text-white">XP Earned</p>
              <p className="text-white/50 mt-1">{campaign.title}</p>
            </motion.div>

            {/* Statistics Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-[#1a1a1a] rounded-2xl p-4 mb-6"
            >
              <p className="text-white/50 text-sm text-center mb-3">Campaign Statistics</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{completionSummary.modulesCompleted}</p>
                  <p className="text-xs text-white/40">Modules</p>
                </div>
                <div className="text-center border-l border-white/10">
                  <p className="text-xl font-bold text-white">{completionSummary.questionsAnswered}</p>
                  <p className="text-xs text-white/40">Questions</p>
                </div>
                <div className="text-center border-l border-white/10">
                  <p className="text-xl font-bold text-amber-400">+{completionSummary.xpEarned}</p>
                  <p className="text-xs text-white/40">XP</p>
                </div>
              </div>
            </motion.div>

            {/* Badges Earned */}
            {completionSummary.badgesEarned && completionSummary.badgesEarned.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="bg-[#1a1a1a] rounded-2xl p-4 mb-6"
              >
                <p className="text-white/50 text-sm text-center mb-3">Badges Earned</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {completionSummary.badgesEarned.map((badge: any) => (
                    <div key={badge.id} className="flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full px-4 py-2 border border-amber-500/30">
                      <span className="text-lg">{badge.icon}</span>
                      <span className="text-white text-sm font-medium">{badge.name}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Continue Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              onClick={() => {
                handleDismissCompletion();
                navigate(`/employee/comparison/${campaign.id}`);
              }}
              className="w-full py-4 bg-white text-black font-semibold rounded-2xl mb-3"
            >
              See Peer Comparison
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Get hero background image from first video thumbnail or campaign
  const heroImage = campaign.items[0] ? videoMap[campaign.items[0].videoId]?.thumbnailUrl : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden lg:hidden">
      {/* Hero Section with Background Image - Fixed */}
      <div className="relative h-[40vh] flex-shrink-0 flex flex-col">
        {/* Background Image */}
        {heroImage ? (
          <div className="absolute inset-0">
            <img
              src={heroImage}
              alt={campaign.title}
              className="w-full h-full object-cover blur-sm scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
          </div>
        )}

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between p-4">
          <button
            onClick={() => navigate('/employee/learn')}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          {hasStarted && (
            <button
              onClick={() => navigate(`/employee/comparison/${campaign.id}`)}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
            >
              <BarChart3 size={20} className="text-white" />
            </button>
          )}
        </div>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-end p-6 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-3xl font-bold text-white leading-tight mb-3">
              {campaign.title}
            </h1>
            {campaign.description && (
              <p className="text-white/70 text-sm leading-relaxed mb-6 line-clamp-3">
                {campaign.description}
              </p>
            )}

            {/* Stats Pills */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full pl-1 pr-4 py-1">
                <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                  <BookOpen size={16} className="text-white" />
                </div>
                <span className="text-white font-medium">{totalVideos} lessons</span>
              </div>
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full pl-1 pr-4 py-1">
                <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                  <Clock size={16} className="text-white" />
                </div>
                <span className="text-white font-medium">{totalEstimatedMinutes} mins</span>
              </div>
              {hasStarted && (
                <div className={`flex items-center gap-2 backdrop-blur-sm rounded-full pl-1 pr-4 py-1 ${
                  progress === 100 ? 'bg-green-500/40' : 'bg-black/40'
                }`}>
                  {progress === 100 ? (
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                      <Check size={16} className="text-white" />
                    </div>
                  ) : (
                    <ProgressRing
                      progress={progress}
                      size={32}
                      strokeWidth={3}
                      color="stroke-white"
                      bgColor="stroke-white/20"
                      showPercentage={false}
                    />
                  )}
                  <span className="text-white font-medium">
                    {progress === 100 ? 'Complete' : `${progress}%`}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Sheet */}
      <div className="relative z-20 -mt-8 bg-black rounded-t-[32px] flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Drag Handle - Fixed */}
        <div className="flex justify-center py-3 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Title - Fixed */}
        <div className="px-6 pb-4 flex-shrink-0">
          <h2 className="text-white font-semibold text-lg">
            {hasStarted ? 'Continue learning:' : 'What you\'ll learn:'}
          </h2>
        </div>

        {/* Module List - Scrollable */}
        <div className="relative flex-1 min-h-0">
          {/* Top fade overlay */}
          <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none" />
          
          <div className="h-full px-6 pb-28 overflow-y-auto scrollbar-hide">
          <div className="relative">
            {/* Timeline line - spans from center of first dot to center of last dot */}
            <div className="absolute left-[11px] top-[56px] bottom-[56px] w-0.5 bg-white/10" />

            {/* Completed portion of timeline */}
            {firstIncompleteIndex > 0 && (
              <div
                className="absolute left-[11px] top-[56px] w-0.5 bg-green-500"
                style={{
                  height: `calc(${((firstIncompleteIndex) / campaign.items.length) * 100}% - 112px)`
                }}
              />
            )}

            <div className="space-y-0">
              {campaign.items.map((item, index) => {
                const chapterNum = index + 1;
                const videoMeta = videoMap[item.videoId];
                const moduleTitle = videoMeta?.title || `Module ${chapterNum}`;
                const moduleState = moduleProgressMap[item.id];
                const completed = !!moduleState?.completed;
                const isCurrent = !completed && firstIncompleteIndex === index && !isComplete;
                const isLocked = !completed && firstIncompleteIndex !== -1 && index > firstIncompleteIndex;

                // Module metadata
                const thumbnailUrl = videoMeta?.thumbnailUrl;
                const videoDuration = videoMeta?.duration ? Math.ceil(videoMeta.duration / 60) : 3;
                const questionCount = videoMeta?.questions?.length || 3;
                const moduleXP = 25 + (questionCount * 5); // Base XP + per question

                // Calculate per-module progress (like desktop)
                const questionTarget = moduleState?.questionTarget || questionCount;
                const progressRatio = moduleState
                  ? ((moduleState.videoFinished ? 1 : 0) +
                    Math.min(moduleState.questionsAnswered || 0, questionTarget)) /
                    (questionTarget + 1)
                  : 0;
                const moduleProgressPercent = Math.round(progressRatio * 100);
                const hasPartialProgress = moduleProgressPercent > 0 && !completed;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative flex items-center gap-4 py-3"
                  >
                    {/* Timeline dot with module number */}
                    <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCurrent
                        ? 'bg-[#00A3FF] ring-4 ring-[#00A3FF]/20'
                        : 'bg-[#1a1a1a] border-2 border-white/20'
                    }`}>
                      <span className={`text-xs font-bold ${
                        isCurrent ? 'text-white' : 'text-white/40'
                      }`}>
                        {chapterNum}
                      </span>
                    </div>

                    {/* Module Card */}
                    <div
                      onClick={() => !isLocked && handleStart()}
                      className={`flex-1 p-3 rounded-2xl transition-colors ${
                        isCurrent
                          ? 'bg-[#00A3FF]/10 border border-[#00A3FF]/30'
                          : 'bg-[#1a1a1a]'
                      } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white/10'}`}
                    >
                      <div className="flex gap-3">
                        {/* Thumbnail */}
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
                          {thumbnailUrl ? (
                            <img
                              src={thumbnailUrl}
                              alt={moduleTitle}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen size={20} className="text-white/20" />
                            </div>
                          )}
                          {/* Status overlay */}
                          {completed && (
                            <div className="absolute inset-0 bg-green-500/80 flex items-center justify-center">
                              <Check size={24} className="text-white" />
                            </div>
                          )}
                          {isLocked && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <Lock size={18} className="text-white/50" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          {/* Module number */}
                          <p className="text-white/40 text-xs mb-0.5">Module {chapterNum}</p>

                          {/* Title */}
                          <p className={`font-medium text-sm leading-tight ${completed || isCurrent ? 'text-white' : 'text-white/60'}`}>
                            {moduleTitle}
                          </p>

                          {/* Metadata row */}
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1 text-white/40">
                              <Clock size={12} />
                              <span className="text-xs">{videoDuration}m</span>
                            </div>
                            <div className="flex items-center gap-1 text-white/40">
                              <MessageCircle size={12} />
                              <span className="text-xs">{questionCount}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[#00A3FF]/70">
                              <Zap size={12} />
                              <span className="text-xs">+{moduleXP}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right side - Progress ring or Status */}
                        <div className="flex items-center">
                          {completed ? (
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                              <Check size={18} className="text-green-400" />
                            </div>
                          ) : isCurrent ? (
                            <div className="w-10 h-10 rounded-full bg-[#00A3FF] flex items-center justify-center">
                              <Play size={16} className="text-white ml-0.5" fill="white" />
                            </div>
                          ) : hasPartialProgress ? (
                            <ProgressRing
                              progress={moduleProgressPercent}
                              size={40}
                              strokeWidth={3}
                              color="stroke-[#00A3FF]"
                              bgColor="stroke-white/10"
                              showPercentage={false}
                            >
                              <span className="text-[10px] font-bold text-white">{moduleProgressPercent}%</span>
                            </ProgressRing>
                          ) : !isLocked ? (
                            <ChevronRight size={20} className="text-white/30" />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            </div>
          </div>
        </div>

        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 px-6 pt-6 pb-6 z-30 bg-gradient-to-t from-black via-black to-transparent pointer-events-none">
          <motion.button
            onClick={handleStart}
            className="w-full py-4 bg-white text-black font-semibold rounded-2xl flex items-center justify-center gap-2 pointer-events-auto"
            whileTap={{ scale: 0.98 }}
          >
            <Play size={20} fill="black" />
            {hasStarted ? 'Continue learning' : 'Start campaign'}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default CampaignDetails;
