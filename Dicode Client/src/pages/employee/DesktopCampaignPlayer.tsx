import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, Check, Lock, Play, Circle,
  HelpCircle, AlertCircle, BookOpen, Clock,
  ChevronDown, ChevronUp, ChevronLeft, Pause, RotateCcw, Volume2, VolumeX, CheckCircle, Zap, MessageCircle, BarChart3, Flame, Trophy
} from 'lucide-react';
import { Skeleton } from '@/components/shared/Skeleton';
import { DesktopLayout } from '@/components/desktop';
import {
  getCampaign,
  getVideo,
  updateVideoProgress,
  saveCampaignResponse,
  updateEnrollmentAccess,
  checkUserEnrollment,
  enrollUserInCampaign,
  setModuleVideoFinished,
  incrementModuleQuestionProgress,
  getCampaignCompletionSummary,
  getCampaignProgress,
  getUserProfile
} from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useCampaignResponsesRealtime, useEnrollmentRealtime } from '@/hooks/useEnrollmentRealtime';
import { useUserStatsRealtime } from '@/hooks/useUserStats';
import type { Campaign, Question } from '@/types';
import PeerComparison from '@/pages/employee/PeerComparison';
import confetti from 'canvas-confetti';
import AICopilot from '@/components/shared/AICopilot';

// Types (reused from VideoModule)
interface VideoWithData {
  id: string;
  itemId: string;
  order: number;
  title: string;
  description?: string;
  videoUrl: string;
  duration?: number;
  competencies: string[];
  questions: Question[];
  questionTarget: number;
  thumbnailUrl?: string; // Added for playlist
}

type SlideType = 'video' | 'question';

interface Slide {
  id: string;
  type: SlideType;
  videoId: string;
  questionId?: string;
  content: VideoWithData | Question;
  index: number;
  itemId: string;
  questionTarget: number;
}

type ResponseValue = string | number | boolean | { selectedOptionId: string; intentScore: number };

const DesktopCampaignPlayerSkeleton = () => {
  return (
    <div className="flex flex-1 h-[calc(100vh-80px)] overflow-hidden">
      {/* Left: Main Player Area Skeleton */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-[#090909] relative">
        <div className="aspect-video bg-white/5 relative shadow-2xl flex items-center justify-center overflow-hidden rounded-3xl mx-6 mt-6 border border-white/5 animate-pulse">
          <Play size={48} className="text-white/10" />
        </div>
        <div className="px-8 pt-2 pb-8 w-full max-w-5xl mt-6 space-y-4">
          <Skeleton className="h-8 w-1/3 bg-white/10" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full bg-white/10" />
            <Skeleton className="h-4 w-2/3 bg-white/10" />
          </div>
        </div>
      </div>

      {/* Right: Playlist Sidebar Skeleton */}
      <div className="w-[480px] bg-[#050608] border-l border-white/5 flex flex-col">
        <div className="p-6 border-b border-white/5 space-y-4">
          <Skeleton className="h-7 w-3/4 bg-white/10" />
          <Skeleton className="h-4 w-full bg-white/10" />

          {/* Progress Bar Skeleton */}
          <div className="space-y-2 mt-4">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16 bg-white/10" />
              <Skeleton className="h-3 w-16 bg-white/10" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full bg-white/10" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-40 aspect-video rounded-lg bg-white/10" />
              <div className="flex-1 py-1 space-y-2">
                <Skeleton className="h-4 w-3/4 bg-white/10" />
                <Skeleton className="h-3 w-full bg-white/10" />
                <Skeleton className="h-3 w-1/4 bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const DesktopCampaignPlayer: React.FC = () => {
  const { moduleId: campaignId } = useParams(); // campaignId
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, ResponseValue>>({});
  const [savingResponse, setSavingResponse] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null); // User-facing error feedback

  // Real-time enrollment hook - always run with skipAutoEnroll=true
  // We handle DiCode enrollment check separately in load logic
  const { enrollment, isLoading: enrollmentLoading } = useEnrollmentRealtime(
    campaignId || '',
    user?.id || '',
    true // skipAutoEnroll - we handle this manually for DiCode campaign check
  );

  // View State
  const [viewMode, setViewMode] = useState<'player' | 'completion' | 'comparison'>('player');
  const [completionSummary, setCompletionSummary] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  // Track video playback positions for each video (videoId -> position in seconds)
  const [videoPositions, setVideoPositions] = useState<Record<string, number>>({});
  const videoPositionsRef = useRef(videoPositions); // Ref for use in useMemo without causing re-renders

  // Ref to track current slide index for use in async callbacks (avoids stale closures)
  const currentSlideIndexRef = useRef(currentSlideIndex);
  const slidesRef = useRef(slides);

  // Keep refs in sync with state
  useEffect(() => {
    currentSlideIndexRef.current = currentSlideIndex;
  }, [currentSlideIndex]);

  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  useEffect(() => {
    videoPositionsRef.current = videoPositions;
  }, [videoPositions]);

  // Real-time responses
  const { responses: savedResponses } = useCampaignResponsesRealtime(
    campaignId || '',
    user?.id || ''
  );

  // User Stats (Streak)
  const { stats: userStats } = useUserStatsRealtime(user?.id || '');

  // Helper to check if completion celebration was already shown
  const wasCompletionShown = (cId: string, completedAt: string | undefined): boolean => {
    if (!completedAt) return false;
    const key = `campaign_completion_shown_${cId}_${completedAt}`;
    return localStorage.getItem(key) === 'true';
  };

  const markCompletionShown = (cId: string, completedAt: string | undefined) => {
    if (!completedAt) return;
    const key = `campaign_completion_shown_${cId}_${completedAt}`;
    localStorage.setItem(key, 'true');
  };

  // Load Logic (Fixed: load campaign first, check DiCode enrollment, restore positions)
  useEffect(() => {
    let isMounted = true;

    const loadCampaignData = async () => {
      if (!campaignId || !user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        // Load campaign data FIRST (to check source type)
        const campaignData = await getCampaign(campaignId);
        if (!isMounted) return;
        if (!campaignData) {
          setLoadError('Campaign not found');
          setIsLoading(false);
          return;
        }

        setCampaign(campaignData);

        // Check enrollment AFTER loading campaign
        let currentEnrollment = await checkUserEnrollment(campaignId, user.id);

        // DiCode campaigns require pre-enrollment (no auto-enroll)
        if (!currentEnrollment && campaignData.source === 'dicode') {
          setLoadError('You are not enrolled in this campaign');
          setIsLoading(false);
          return;
        }

        // For org campaigns, auto-enroll if needed
        if (!currentEnrollment) {
          // Get user's organization - fetch from Firestore if not in hydrated user
          let userOrgId = user.organization;
          if (!userOrgId) {
            const profile = await getUserProfile(user.id);
            userOrgId = profile?.organization || '';
          }

          // Validate user's org is in campaign's allowedOrganizations
          const allowedOrgs = campaignData.allowedOrganizations || [];
          if (userOrgId && allowedOrgs.length > 0 && !allowedOrgs.includes(userOrgId)) {
            console.warn('[auto-enroll] User org not in campaign allowedOrganizations');
            setLoadError('You do not have access to this campaign');
            setIsLoading(false);
            return;
          }

          await enrollUserInCampaign(campaignId, user.id, userOrgId, 'system', true);
          currentEnrollment = await checkUserEnrollment(campaignId, user.id);
        }

        await updateEnrollmentAccess(campaignId, user.id);

        // Load saved video progress from Firestore to restore positions
        const progressData = await getCampaignProgress(campaignId, user.id);
        const initialPositions: Record<string, number> = {};
        progressData.forEach((p) => {
          // Only restore position if video not completed and has progress
          if (!p.completed && p.watchedDuration > 0) {
            initialPositions[p.videoId] = p.watchedDuration;
          }
        });
        if (Object.keys(initialPositions).length > 0) {
          setVideoPositions(initialPositions);
        }

        if (campaignData.items.length === 0) {
          setLoadError('This campaign has no videos yet');
          setIsLoading(false);
          return;
        }

        const sortedItems = [...campaignData.items].sort((a, b) => a.order - b.order);

        const videoDataPromises = sortedItems.map(async (item) => {
          const videoData = await getVideo(item.videoId);
          if (!videoData) return null;
          const questionTarget = Array.isArray(videoData.questions) ? videoData.questions.length : 0;

          return {
            id: item.videoId,
            itemId: item.id,
            order: item.order,
            title: videoData.title,
            description: videoData.description,
            videoUrl: videoData.storageUrl,
            duration: videoData.duration,
            competencies: videoData.metadata.tags || [],
            questions: videoData.questions || [],
            questionTarget,
            thumbnailUrl: videoData.thumbnailUrl,
          };
        });

        const videosData = (await Promise.all(videoDataPromises)).filter(Boolean) as VideoWithData[];

        if (!isMounted) return;

        if (videosData.length === 0) {
          setLoadError('Failed to load video content');
          setIsLoading(false);
          return;
        }

        const generatedSlides: Slide[] = [];
        let globalIndex = 0;
        const moduleStartIndices: Record<string, number> = {};

        videosData.forEach((video) => {
          moduleStartIndices[video.itemId] = globalIndex;

          generatedSlides.push({
            id: `video-${video.id}`,
            type: 'video',
            videoId: video.id,
            content: video,
            itemId: video.itemId,
            questionTarget: video.questionTarget,
            index: globalIndex++,
          });

          video.questions.forEach((question) => {
            generatedSlides.push({
              id: `q-${video.id}-${question.id}`,
              type: 'question',
              videoId: video.id,
              questionId: question.id,
              content: question,
              itemId: video.itemId,
              questionTarget: video.questionTarget,
              index: globalIndex++,
            });
          });
        });

        let startingSlideIndex = 0;
        if (currentEnrollment?.moduleProgress) {
          for (const item of sortedItems) {
            const moduleState = currentEnrollment.moduleProgress[item.id];
            if (!moduleState?.completed) {
              const moduleVideoIndex = moduleStartIndices[item.id] || 0;

              // If video is finished, skip to first unanswered question
              if (moduleState?.videoFinished && moduleState?.questionsAnswered > 0) {
                // Find the question slide to resume from
                const questionsAnswered = moduleState.questionsAnswered;
                const moduleSlides = generatedSlides.filter(s => s.itemId === item.id);
                const questionSlides = moduleSlides.filter(s => s.type === 'question');

                // Skip to the question after the last answered one
                if (questionsAnswered < questionSlides.length) {
                  startingSlideIndex = questionSlides[questionsAnswered].index;
                } else {
                  // All questions answered but module not marked complete - start from video
                  startingSlideIndex = moduleVideoIndex;
                }
              } else if (moduleState?.videoFinished) {
                // Video done but no questions answered - go to first question
                const firstQuestion = generatedSlides.find(
                  s => s.itemId === item.id && s.type === 'question'
                );
                startingSlideIndex = firstQuestion?.index || moduleVideoIndex;
              } else {
                // Video not done - start from video
                startingSlideIndex = moduleVideoIndex;
              }
              break;
            }
          }
        }

        console.log('Starting slide index:', startingSlideIndex);

        setSlides(generatedSlides);
        // Important: Set this AFTER slides are set so it renders correctly
        setCurrentSlideIndex(startingSlideIndex);
        setIsLoading(false);

        // If campaign is already completed, show completion view
        if (currentEnrollment?.status === 'completed') {
          setViewMode('completion');
        }

      } catch (error) {
        console.error('Failed to load campaign:', error);
        if (isMounted) {
          setLoadError('Unable to load this campaign.');
          setIsLoading(false);
        }
      }
    };

    loadCampaignData();
    return () => { isMounted = false; };
  }, [campaignId, user]);

  // Pre-fill responses logic (reconstruct SJT object from saved response)
  useEffect(() => {
    if (slides.length > 0 && Object.keys(savedResponses).length > 0) {
      const preFilledResponses: Record<string, any> = {};
      slides.forEach((slide) => {
        if (slide.type === 'question') {
          const question = slide.content as Question;
          const questionId = question.id;
          const key = `${slide.videoId}_${questionId}`;
          const saved = savedResponses[key];
          if (saved) {
            // For SJT questions, reconstruct the full response object
            // selectedOptionId is at TOP LEVEL of saved response (not in metadata)
            const isSJT = question.type === 'behavioral-intent' && saved.selectedOptionId;
            if (isSJT) {
              preFilledResponses[key] = {
                selectedOptionId: saved.selectedOptionId,
                intentScore: saved.answer
              };
            } else {
              preFilledResponses[key] = saved.answer;
            }
          }
        }
      });
      if (Object.keys(preFilledResponses).length > 0) {
        setResponses(prev => ({ ...prev, ...preFilledResponses }));
      }
    }
  }, [slides, savedResponses]);

  // Load completion summary when campaign is completed OR when completion view is shown
  // (to handle race condition where Cloud Function hasn't updated enrollment status yet)
  useEffect(() => {
    const loadCompletionSummary = async () => {
      if (!campaignId || !user?.id || !user?.organization) return;

      // Fetch summary if enrollment is completed OR if completion view is being shown
      // This handles the race condition where user just finished but status isn't updated yet
      if (enrollment?.status === 'completed' || viewMode === 'completion') {
        try {
          const summary = await getCampaignCompletionSummary(user.id, campaignId, user.organization);
          setCompletionSummary(summary);

          // Determine if we should show completion screen automatically
          // Only show if we haven't dismissed it before for this completion instance
          const completedAt = summary?.completedAt || enrollment?.completedAt;
          const alreadyShown = wasCompletionShown(campaignId, completedAt);

          // If just completed (e.g. from partial progress or active session),
          // we might want to trigger it.
          // For now, let's rely on the player reaching the end to trigger viewMode change,
          // OR if we load effectively into a completed campaign and haven't seen it?
          // The requirement is "when we complete a module... render in the content area".
          // So the trigger is likely the transition from last slide -> done.

        } catch (error) {
          console.error('Failed to load completion summary:', error);
        }
      }
    };

    loadCompletionSummary();
  }, [campaignId, user?.id, user?.organization, enrollment?.status, enrollment?.completedAt, viewMode]);

  useEffect(() => {
    if (viewMode === 'completion' && !showConfetti) {
      setShowConfetti(true);
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 } // Slightly lower/center to match the card
      });
    }
  }, [viewMode, showConfetti]);

  // Note: enrollment is now managed by useEnrollmentRealtime hook
  // No need for manual refreshEnrollment - the hook provides real-time updates

  // Actions
  const handleVideoCompleted = async (
    itemId: string,
    videoId: string,
    questionTarget: number,
    watchedDuration?: number,
    totalDuration?: number
  ) => {
    if (!campaign || !user) return;
    try {
      if (watchedDuration !== undefined && totalDuration !== undefined) {
        updateVideoProgress(campaign.id, user.id, videoId, user.organization || '', watchedDuration, totalDuration).catch(console.error);
      }
      await setModuleVideoFinished(campaign.id, user.id, itemId, {
        questionTarget,
        watchedDuration,
        totalDuration,
      });

      // Note: enrollment state is updated automatically by useEnrollmentRealtime hook
      // We'll check completion status after a brief delay to allow Firestore update

      // Use refs for current values to avoid stale closures
      const currentIndex = currentSlideIndexRef.current;
      const currentSlides = slidesRef.current;

      // Auto-advance to first question if exists
      const nextSlide = currentSlides[currentIndex + 1];
      if (nextSlide && nextSlide.videoId === videoId) {
        setCurrentSlideIndex(prev => prev + 1);
      } else {
        // If no more questions for this video, move to next module or check completion
        const nextModuleSlide = currentSlides[currentIndex + 1];
        if (nextModuleSlide) {
          // There's another module - advance to it
          setCurrentSlideIndex(prev => prev + 1);
        } else if (currentIndex === currentSlides.length - 1) {
          // This is the last slide of the entire campaign
          // Show completion screen - we just finished the last video
          // The real-time enrollment hook will sync the status in the background
          setViewMode('completion');
          markCompletionShown(campaignId!, new Date().toISOString());
        }
      }
    } catch (error) {
      console.error('Failed to record completion', error);
      setActionError('Failed to save video progress. Please try again.');
      // Auto-dismiss error after 5 seconds
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const handleAnswer = async (questionId: string, videoId: string, answer: ResponseValue) => {
    const key = `${videoId}_${questionId}`;
    setResponses(prev => ({ ...prev, [key]: answer }));

    // Use refs for current values to avoid stale closures
    const currentIndex = currentSlideIndexRef.current;
    const currentSlides = slidesRef.current;
    const currentSlide = currentSlides[currentIndex];

    if (!campaign || !user || !currentSlide) return;

    setSavingResponse(key);
    try {
      const question = currentSlide.content as Question;
      const isSJT = typeof answer === 'object' && 'selectedOptionId' in answer;
      const val = isSJT ? (answer as any).intentScore : answer;

      await saveCampaignResponse(
        campaign.id, currentSlide.videoId, questionId, user.id, user.organization || '',
        val,
        {
          questionType: question.type,
          questionText: question.statement,
          competencyId: question.competencyId,
          skillId: question.skillId,
          ...(isSJT && {
            selectedOptionId: (answer as any).selectedOptionId,
            intentScore: (answer as any).intentScore
          })
        }
      );

      await incrementModuleQuestionProgress(
        campaign.id, user.id, currentSlide.itemId, currentSlide.questionTarget, 1, questionId
      );

      // Add delay for user to see "Saved" confirmation before advancing (match mobile UX)
      await new Promise(resolve => setTimeout(resolve, 800));

      // If we are at the last slide, we are done
      if (currentIndex === currentSlides.length - 1) {
        // Show completion screen optimistically - don't wait for Cloud Function to update status
        // The real-time enrollment hook will sync the status in the background
        setViewMode('completion');
        markCompletionShown(campaignId!, new Date().toISOString());
      } else {
        setCurrentSlideIndex(prev => prev + 1);
      }
    } catch (err) {
      console.error('Failed to save response:', err);
      setActionError('Failed to save your response. Please try again.');
      // Auto-dismiss error after 5 seconds
      setTimeout(() => setActionError(null), 5000);
      // Revert local response state on error so user can retry
      setResponses(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    } finally {
      setSavingResponse(null);
    }
  };

  // Handler to track video playback positions
  const handleVideoPositionChange = (videoId: string, position: number) => {
    setVideoPositions(prev => ({ ...prev, [videoId]: position }));
  };

  // Find the resume index for a module (first unanswered question, or video if not watched)
  const getModuleResumeIndex = (item: typeof playlist[0]): number => {
    const moduleProgress = enrollment?.moduleProgress?.[item.itemId];

    // If video not finished, start from video
    if (!moduleProgress?.videoFinished) {
      return item.startIndex;
    }

    // Video finished - find first unanswered question
    const moduleSlides = slides.filter(s => s.videoId === item.videoId);
    for (const slide of moduleSlides) {
      if (slide.type === 'question') {
        const question = slide.content as Question;
        const responseKey = `${item.videoId}_${question.id}`;
        // Check both local responses and saved responses from Firestore
        if (!responses[responseKey] && !savedResponses[responseKey]) {
          return slide.index;
        }
      }
    }

    // All questions answered - start from video (module is complete)
    return item.startIndex;
  };

  // Group slides into Playlist Items (Modules)
  const playlist = useMemo(() => {
    const items: {
      videoId: string;
      itemId: string;
      title: string;
      description: string;
      duration: number;
      thumbnail?: string;
      startIndex: number;
      slideCount: number;
      isActive: boolean;
      isCompleted: boolean;
      isLocked: boolean;
      questions: Question[];
    }[] = [];

    let currentVideoId = '';
    slides.forEach((slide) => {
      if (slide.type === 'video') {
        const vid = slide.content as VideoWithData;
        currentVideoId = vid.id;
        items.push({
          videoId: vid.id,
          itemId: slide.itemId,
          title: vid.title,
          description: vid.description || '',
          duration: vid.duration || 0,
          thumbnail: vid.thumbnailUrl,
          startIndex: slide.index,
          slideCount: 1, // counts video slide
          isActive: false,
          isCompleted: false,
          isLocked: false,
          questions: []
        });
      } else {
        const lastItem = items[items.length - 1];
        if (lastItem && lastItem.videoId === currentVideoId) {
          lastItem.slideCount++;
          lastItem.questions.push(slide.content as Question);
        }
      }
    });

    // Calculate status using enrollment.moduleProgress for accurate completion state
    // First pass: determine completion status for each module
    const moduleProgressMap = enrollment?.moduleProgress || {};
    const itemsWithCompletion = items.map(item => {
      const moduleProgress = moduleProgressMap[item.itemId];
      const isCompleted = moduleProgress?.completed === true;
      return { ...item, isCompleted };
    });

    // Second pass: determine lock status based on previous module completion
    // A module is locked if ALL previous modules are not completed
    return itemsWithCompletion.map((item, idx) => {
      const isActive = currentSlideIndex >= item.startIndex && currentSlideIndex < (item.startIndex + item.slideCount);

      // First module is never locked
      // A module is unlocked if it's first, OR the previous module is completed
      const isLocked = idx > 0 && !itemsWithCompletion[idx - 1].isCompleted;

      return { ...item, isActive, isLocked };
    });
  }, [slides, currentSlideIndex, enrollment?.moduleProgress]);

  // Current Active Data
  const currentSlide = slides[currentSlideIndex];
  const activeVideo = useMemo(() => {
    if (!currentSlide) return null;
    // Find the video content for the current slide (even if it's a question)
    const vidSlide = slides.find(s => s.videoId === currentSlide.videoId && s.type === 'video');
    return vidSlide ? (vidSlide.content as VideoWithData) : null;
  }, [currentSlide, slides]);

  // Map video IDs to their data for easy lookup (e.g., for question background)
  const videoMap = useMemo(() => {
    const map: Record<string, VideoWithData> = {};
    slides.forEach(slide => {
      if (slide.type === 'video') {
        map[slide.videoId] = slide.content as VideoWithData;
      }
    });
    return map;
  }, [slides]);

  // Check if all modules are completed (for robust completion check)
  const allModulesCompleted = useMemo(() => {
    if (playlist.length === 0) return false;
    return playlist.every(item => item.isCompleted);
  }, [playlist]);

  // Calculate overall progress based on partial module progress (same formula as Mobile CampaignDetails)
  // This considers video watched + questions answered, not just fully completed modules
  const overallProgress = useMemo(() => {
    if (!campaign || playlist.length === 0) return 0;

    const moduleProgressMap = enrollment?.moduleProgress || {};
    const totalItems = playlist.length;

    const progressSum = playlist.reduce((sum, item) => {
      const moduleState = moduleProgressMap[item.itemId];
      // Use questions.length from playlist item, or moduleState.questionTarget, or default 3
      const questionTarget = moduleState?.questionTarget || item.questions.length || 3;

      if (!moduleState) return sum;

      // Same formula as Mobile: (videoFinished + questionsAnswered) / (questionTarget + 1)
      const progressRatio = (
        (moduleState.videoFinished ? 1 : 0) +
        Math.min(moduleState.questionsAnswered || 0, questionTarget)
      ) / (questionTarget + 1);

      return sum + progressRatio;
    }, 0);

    const percentage = Math.round((progressSum / totalItems) * 100);
    return Number.isNaN(percentage) ? 0 : percentage;
  }, [campaign, playlist, enrollment?.moduleProgress]);

  // Render completion view
  const renderCompletionView = () => {
    if (!completionSummary && !enrollment) return null;

    // Use XP from enrollment (set by cloud function) if available, with fallbacks
    const xpEarned = enrollment?.xpEarned || completionSummary?.xpEarned || 50;
    const modulesCompleted = completionSummary?.modulesCompleted || enrollment?.completedModules || 0;
    const questionsAnswered = completionSummary?.questionsAnswered || 0;

    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[#090909] relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]" />

        <div className="relative z-10 w-full max-w-md text-center">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-b from-green-500/20 to-transparent flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                  <Check size={32} className="text-white" strokeWidth={4} />
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-4xl font-bold text-white mb-2">Campaign Completed!</h2>
          <p className="text-white/50 mb-8 max-w-sm mx-auto">
            Great job! You're finished with <span className="text-white font-medium">{campaign?.title}</span>.
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-sm">
              <div className="text-2xl font-bold text-white mb-1">{modulesCompleted}</div>
              <div className="text-xs text-white/40 uppercase tracking-wider">Modules</div>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-sm">
              <div className="text-2xl font-bold text-white mb-1">{questionsAnswered}</div>
              <div className="text-xs text-white/40 uppercase tracking-wider">Questions</div>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-amber-500/10" />
              <div className="relative text-2xl font-bold text-amber-400 mb-1">+{xpEarned}</div>
              <div className="relative text-xs text-white/40 uppercase tracking-wider">XP Earned</div>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-orange-500/10" />
              <div className="relative flex items-center justify-center gap-1 mb-1">
                <Flame size={20} className="text-orange-500 fill-orange-500" />
                <span className="text-2xl font-bold text-orange-400">{userStats.currentStreak}</span>
              </div>
              <div className="relative text-xs text-white/40 uppercase tracking-wider">Day Streak</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setViewMode('comparison')}
              className="w-full py-4 bg-white hover:bg-white/90 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <BarChart3 size={20} />
              View Peer Comparison
            </button>
            <button
              onClick={() => navigate('/employee/home')}
              className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render Logic
  const content = useMemo(() => {
    if (isLoading) return <DesktopCampaignPlayerSkeleton />;

    if (loadError) {
      return (
        <div className="flex flex-1 items-center justify-center text-white/50 h-[calc(100vh-80px)]">
          <div className="text-center">
            <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">{loadError}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-1 h-[calc(100vh-80px)] overflow-hidden">
        {/* Error Banner */}
        {actionError && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
            <div className="bg-red-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
              <AlertCircle size={20} />
              <span className="font-medium">{actionError}</span>
              <button
                onClick={() => setActionError(null)}
                className="ml-2 hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Left: Main Player Area */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-[#090909] relative">
          {/* CONTENT SWITCHER */}
          {viewMode === 'player' ? (
            <>
              {/* Video Container - Enforce Landscape 16:9 */}
              <div className="aspect-video bg-black relative shadow-2xl flex items-center justify-center overflow-hidden rounded-3xl mx-6 mt-6 border border-white/5">
                {activeVideo && (
                  <>
                    {/* We only render the video if we are on the video slide.
                           If we are on a question slide, we want the video to be "paused" or "background".
                           Actually, for smooth transitions, the video player should probably persist
                           and we just overlay the question.
                       */}
                    <div className="w-full h-full">
                      <VideoPlayer
                        key={activeVideo.id}
                        src={activeVideo.videoUrl}
                        videoId={activeVideo.id}
                        poster={activeVideo.thumbnailUrl}
                        shouldPlay={currentSlide.type === 'video'}
                        initialPosition={videoPositionsRef.current[activeVideo.id] || 0}
                        onEnded={(watchedDuration, totalDuration) => {
                          // When video ends, perform completion logic with actual watched time
                          handleVideoCompleted(activeVideo.itemId, activeVideo.id, activeVideo.questionTarget, watchedDuration, totalDuration);
                        }}
                        onProgress={(w, t) => {
                          // Only track if on video slide
                          if (currentSlide.type === 'video') {
                            updateVideoProgress(campaign!.id, user!.id, activeVideo.id, user!.organization || '', w, t);
                          }
                        }}
                        onPositionChange={handleVideoPositionChange}
                      />
                    </div>

                    {/* Question Overlay */}
                    <AnimatePresence>
                      {currentSlide.type === 'question' && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 sm:p-8 md:p-10 lg:p-12"
                        >
                          <div className="w-full max-w-2xl max-h-full">
                            {/* Check if this module is completed - show summary instead of questions */}
                            {playlist.find(p => p.videoId === activeVideo.id)?.isCompleted ? (
                              <ModuleSummary
                                questions={activeVideo.questions}
                                videoId={activeVideo.id}
                                responses={responses}
                                savedResponses={savedResponses}
                              />
                            ) : (
                              <QuestionCard
                                question={currentSlide.content as Question}
                                response={responses[`${activeVideo.id}_${(currentSlide.content as Question).id}`]}
                                onAnswer={(val) => handleAnswer((currentSlide.content as Question).id, activeVideo.id, val)}
                                isSaving={savingResponse === `${activeVideo.id}_${(currentSlide.content as Question).id}`}
                                index={slides.filter(s => s.type === 'question' && s.videoId === activeVideo.id && s.index <= currentSlide.index).length}
                                total={activeVideo.questions.length}
                              />
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>

              {/* Overview / Description */}
              <div className="px-8 pt-2 pb-8 w-full max-w-5xl">
                <div className="flex items-center gap-2 text-[#00A3FF] text-sm font-medium mb-4">
                  <Clock size={16} />
                  <span>Overview</span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-4">{activeVideo?.title}</h1>

                {/* Skill Chips */}
                {activeVideo?.competencies && activeVideo.competencies.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {activeVideo.competencies.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/80 border border-white/10"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-white/70 leading-relaxed text-base whitespace-pre-wrap">
                  {activeVideo?.description}
                </p>
              </div>
            </>
          ) : viewMode === 'completion' ? (
            /* Completion View */
            <div className="flex-1 overflow-y-auto">
              {renderCompletionView()}
            </div>
          ) : (
            /* Comparison View */
            <div className="flex-1 overflow-y-auto bg-[#050608]">
              <PeerComparison
                campaignIdOverride={campaignId}
                embedded={true}
              />
            </div>
          )}
        </div>

        {/* Right: Playlist Sidebar */}
        <div className="w-[480px] bg-[#050608] border-l border-white/5 flex flex-col">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-bold text-white mb-2 leading-tight">{campaign?.title}</h2>
            <p className="text-sm text-white/50 line-clamp-2 mb-4">{campaign?.description}</p>

            {/* Total Campaign Progress - uses same formula as Mobile (video+questions progress) */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-white/60 mb-1.5 font-medium">
                <span>{overallProgress}% Complete</span>
                <span>{playlist.filter(m => m.isCompleted).length}/{playlist.length}</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00A3FF] transition-all duration-500 ease-out"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-white/30 uppercase tracking-wider font-medium">
              <span>{slides.filter(s => s.type === 'video').length} Modules</span>
              <span>{campaign?.metadata.computed?.estimatedMinutes || 0} min total</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {playlist.map((item, idx) => (
              <button
                key={item.videoId}
                onClick={() => {
                  if (!item.isLocked) {
                    // Dismiss completion screen if showing
                    if (viewMode === 'completion' || viewMode === 'comparison') {
                      setViewMode('player');
                    }
                    // Resume from first unanswered question if video is done
                    setCurrentSlideIndex(getModuleResumeIndex(item));
                  }
                }}
                disabled={item.isLocked}
                className={`w-full flex gap-3 text-left group ${
                  item.isLocked
                    ? 'opacity-40 cursor-not-allowed'
                    : item.isActive
                    ? 'opacity-100'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative w-40 aspect-video bg-white/5 rounded-lg overflow-hidden flex-shrink-0 border border-white/5 group-hover:border-white/10 transition-colors">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" className={`w-full h-full object-cover ${item.isLocked ? 'grayscale' : ''}`} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10">
                      <Play size={24} />
                    </div>
                  )}
                  {/* Lock Overlay for locked modules */}
                  {item.isLocked && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Lock size={20} className="text-white/50" />
                    </div>
                  )}
                  {/* Status Overlay - only show on hover for unlocked modules */}
                  {!item.isLocked && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play size={20} fill="white" className="text-white" />
                    </div>
                  )}
                  {item.isActive && (
                    <div className="absolute inset-0 border-2 border-[#00A3FF] rounded-lg z-10 pointer-events-none" />
                  )}
                  {item.duration > 10 && (
                    <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] text-white font-medium">
                      {Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, '0')}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 py-1">
                  <h3 className={`text-sm font-semibold leading-snug mb-1 line-clamp-2 ${
                    item.isLocked ? 'text-white/40' : item.isActive ? 'text-white' : 'text-white/80'
                  }`}>
                    {item.title}
                  </h3>
                  <p className="text-xs text-white/40 line-clamp-2 mb-2 text-start">
                    {item.description}
                  </p>

                  <div className="flex items-center gap-2 mt-1">
                    {item.isCompleted ? (
                      <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        <Check size={10} strokeWidth={3} />
                        <span>Completed</span>
                      </div>
                    ) : item.isLocked ? (
                      <div className="flex items-center gap-1 text-[10px] text-white/30 font-medium bg-white/5 px-1.5 py-0.5 rounded">
                        <Lock size={10} />
                        <span>Locked</span>
                      </div>
                    ) : item.isActive ? (
                      <span className="text-[10px] text-[#00A3FF] font-medium bg-[#00A3FF]/10 px-1.5 py-0.5 rounded">
                        Playing
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/30 font-medium bg-white/5 px-1.5 py-0.5 rounded">
                        {idx + 1}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  // Note: videoPositions is excluded from dependencies to prevent excessive re-renders during video playback.
  // Initial position is loaded from Firestore, and the VideoPlayer handles position tracking internally.
  }, [isLoading, loadError, activeVideo, currentSlide, playlist, campaign, slides, responses, savedResponses, savingResponse, actionError, viewMode]);

  // Build breadcrumbs based on current view mode
  const breadcrumbs = [
    { label: 'Learn', path: '/employee/learn' },
    { label: campaign?.title || 'Loading...' }
  ];

  // Add "Peer Responses" breadcrumb when in comparison view
  if (viewMode === 'comparison') {
    breadcrumbs.push({ label: 'Peer Responses' });
  }

  return (
    <DesktopLayout
      activePage="learn"
      title={viewMode === 'comparison' ? 'Peer Responses' : (campaign?.title || 'Campaign')}
      breadcrumbs={breadcrumbs}
      onAICopilotClick={() => setIsCopilotOpen(true)}
    >
      {content}
      {isCopilotOpen && (
        <AICopilot
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          context={{
            userRole: 'employee',
            learningContext: {
              currentCampaign: campaign?.id,
              currentCampaignTitle: campaign?.title,
              currentModule: currentSlide?.itemId,
              currentModuleTitle: slides.find(s => s.type === 'video' && s.itemId === currentSlide.itemId)?.content.id || '',
              streakStatus: {
                current: userStats.currentStreak,
                atRisk: false,
              },
            }
          }}
        />
      )}
    </DesktopLayout>
  );
};

// Video Player Component
interface VideoPlayerProps {
  src: string;
  videoId: string;
  poster?: string;
  shouldPlay: boolean;
  initialPosition?: number;
  onEnded: (watchedDuration: number, totalDuration: number) => void;
  onProgress: (watched: number, total: number) => void;
  onPositionChange?: (videoId: string, position: number) => void;
}

const VideoPlayer = ({ src, videoId, poster, shouldPlay, initialPosition, onEnded, onProgress, onPositionChange }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasRestoredPosition = useRef(false);
  const hasEndedRef = useRef(false);
  const maxWatchTimeRef = useRef(0); // Track maximum position reached

  // Reset refs when video source changes
  useEffect(() => {
    hasRestoredPosition.current = false;
    hasEndedRef.current = false;
    maxWatchTimeRef.current = 0;
  }, [src]);

  useEffect(() => {
    if (videoRef.current) {
      if (shouldPlay) {
        videoRef.current.play().catch(() => { });
      } else {
        videoRef.current.pause();
      }
    }
  }, [shouldPlay]);

  const handleLoadedMetadata = () => {
    if (videoRef.current && initialPosition && !hasRestoredPosition.current && initialPosition > 0) {
      // Only restore if we haven't completed the video yet
      if (initialPosition < videoRef.current.duration - 1) {
        videoRef.current.currentTime = initialPosition;
        maxWatchTimeRef.current = initialPosition; // Initialize max time from restored position
      }
      hasRestoredPosition.current = true;
    }
  };

  const handleEnded = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    // Use actual tracked watch time, not just assume 100%
    const totalDuration = videoRef.current?.duration || 0;
    const watchedDuration = Math.max(
      maxWatchTimeRef.current,
      videoRef.current?.currentTime || 0
    );

    // Seek back slightly to keep the last frame visible (browsers show black after video ends)
    if (videoRef.current && totalDuration > 0.5) {
      videoRef.current.currentTime = totalDuration - 0.1;
    }

    onEnded(watchedDuration, totalDuration);
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const currentTime = e.currentTarget.currentTime;
    const duration = e.currentTarget.duration;

    // Track maximum position reached (handles seeking forward/backward)
    maxWatchTimeRef.current = Math.max(maxWatchTimeRef.current, currentTime);

    onProgress(currentTime, duration);

    // Store position for restoration later
    if (onPositionChange && !isNaN(currentTime)) {
      onPositionChange(videoId, currentTime);
    }
  };

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      className="w-full h-full object-contain"
      controls={shouldPlay}
      onLoadedMetadata={handleLoadedMetadata}
      onEnded={handleEnded}
      onTimeUpdate={handleTimeUpdate}
    />
  );
};


// Module Summary Component - shows all questions and answers for completed modules
interface ModuleSummaryProps {
  questions: Question[];
  videoId: string;
  responses: Record<string, ResponseValue>;
  savedResponses: Record<string, any>;
}

const ModuleSummary = ({ questions, videoId, responses, savedResponses }: ModuleSummaryProps) => {
  // Get the answer display for a question
  const getAnswerDisplay = (question: Question, responseKey: string): string => {
    // Get response from local state first, then fallback to saved responses
    const localResponse = responses[responseKey];
    const savedResponse = savedResponses[responseKey];

    // For SJT questions, we need to handle multiple response formats:
    // 1. Local response: { selectedOptionId, intentScore }
    // 2. Saved response: { selectedOptionId at top level, answer: intentScore }
    if (question.type === 'behavioral-intent' && question.options) {
      let selectedOptionId: string | undefined;

      // Check local response first (reconstructed SJT object)
      if (localResponse && typeof localResponse === 'object' && 'selectedOptionId' in localResponse) {
        selectedOptionId = (localResponse as any).selectedOptionId;
      }
      // Fallback to saved response - selectedOptionId is at TOP LEVEL (not in metadata)
      else if (savedResponse?.selectedOptionId) {
        selectedOptionId = savedResponse.selectedOptionId;
      }

      if (!selectedOptionId) return 'Not answered';

      const selectedOption = question.options.find((opt: any) => opt.id === selectedOptionId);
      return selectedOption?.text || 'Not answered';
    }

    // For non-SJT questions, get the response value
    const response = localResponse ?? savedResponse?.answer;

    if (response === undefined || response === null) return 'Not answered';

    // Likert/scale questions - show the number
    if (typeof response === 'number') {
      const lowLabel = question.scaleLabels?.low || 'Low';
      const highLabel = question.scaleLabels?.high || 'High';
      const scaleMax = question.scaleType === '4-point' ? 4 : question.scaleType === '5-point' ? 5 : 7;
      return `${response}/${scaleMax} (${response <= scaleMax / 2 ? lowLabel : highLabel})`;
    }

    // Text responses
    if (typeof response === 'string') {
      return response.length > 100 ? `${response.substring(0, 100)}...` : response;
    }

    return 'Answered';
  };

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 shadow-2xl max-h-full overflow-y-auto">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Check size={16} className="text-emerald-400" strokeWidth={3} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Module Completed</h3>
          <p className="text-xs text-white/50">Your responses summary</p>
        </div>
      </div>

      <div className="space-y-3">
        {questions.map((question, idx) => {
          const responseKey = `${videoId}_${question.id}`;
          const answerDisplay = getAnswerDisplay(question, responseKey);

          return (
            <div key={question.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
              <div className="flex items-start gap-2 mb-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#00A3FF]/20 flex items-center justify-center text-[10px] font-bold text-[#00A3FF]">
                  {idx + 1}
                </span>
                <p className="text-xs text-white/70 leading-relaxed line-clamp-2">
                  {question.statement}
                </p>
              </div>
              <div className="ml-7 flex items-center gap-2">
                <Check size={12} className="text-emerald-400 flex-shrink-0" />
                <p className="text-xs text-white/90 line-clamp-2">{answerDisplay}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Question Component
interface QuestionCardProps {
  question: Question;
  response: ResponseValue | undefined;
  onAnswer: (val: ResponseValue) => void;
  isSaving: boolean | null;
  index: number;
  total: number;
}

const QuestionCard = ({ question, response, onAnswer, isSaving, index, total }: QuestionCardProps) => {
  const isAnswered = response !== undefined;
  const isSJT = question.type === 'behavioral-intent' && question.options && question.options.length > 0;

  // Local state for text input
  const [textValue, setTextValue] = React.useState('');

  // Sync state with prop if it changes (e.g. loading saved response)
  React.useEffect(() => {
    if (typeof response === 'string') {
      setTextValue(response);
    }
  }, [response]);

  // Get scale points based on question.scaleType (defaults to 7-point)
  const getScalePoints = (): number[] => {
    switch (question.scaleType) {
      case '4-point': return [1, 2, 3, 4];
      case '5-point': return [1, 2, 3, 4, 5];
      case '7-point':
      default: return [1, 2, 3, 4, 5, 6, 7];
    }
  };

  const scalePoints = getScalePoints();

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 shadow-2xl max-h-full">
      <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
        <span className="text-xs sm:text-sm font-medium text-[#00A3FF]">Question {index}/{total}</span>
        {isSaving ? (
          <span className="text-[10px] sm:text-xs text-white/30 animate-pulse">Saving...</span>
        ) : isAnswered ? (
          <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-emerald-400 font-medium bg-emerald-500/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
            <Check size={10} className="sm:w-3 sm:h-3" strokeWidth={3} />
            <span>Answered</span>
          </div>
        ) : null}
      </div>

      <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mb-2 sm:mb-3 md:mb-4 leading-snug">
        {question.statement}
      </h2>

      {isSJT ? (
        <div className="flex flex-col gap-1.5 sm:gap-2 max-h-[40vh] overflow-y-auto pr-1">
          {question.options?.map((opt: any, idx: number) => (
            <button
              key={opt.id}
              onClick={() => !isAnswered && onAnswer({ selectedOptionId: opt.id, intentScore: opt.intentScore })}
              disabled={isAnswered}
              className={`w-full px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 rounded-lg text-left text-xs sm:text-sm border transition-all flex items-center gap-2 sm:gap-3 ${(response as any)?.selectedOptionId === opt.id
                ? 'bg-[#00A3FF]/20 border-[#00A3FF] text-white'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                }`}
            >
              <span className={`flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-medium ${
                (response as any)?.selectedOptionId === opt.id
                  ? 'bg-[#00A3FF] text-white'
                  : 'bg-white/10 text-white/50'
              }`}>
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="flex-1 min-w-0 line-clamp-2">{opt.text}</span>
            </button>
          ))}
        </div>
      ) : (question.type === 'qualitative' || question.type === 'commitment') ? (
        <div className="space-y-2 sm:space-y-3 md:space-y-4">
          <textarea
            placeholder="Type your answer here..."
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            className="w-full text-xs sm:text-sm bg-white/5 border border-white/10 rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 text-white placeholder-white/30 focus:outline-none focus:border-[#00A3FF] min-h-[80px] sm:min-h-[100px] md:min-h-[120px] resize-none"
            disabled={isAnswered}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isAnswered && textValue.trim()) {
                e.preventDefault();
                onAnswer(textValue);
              }
            }}
          />
          {!isAnswered ? (
            <button
              onClick={() => textValue.trim() && onAnswer(textValue)}
              disabled={!textValue.trim()}
              className="w-full py-2 sm:py-2.5 md:py-3 rounded-lg sm:rounded-xl bg-[#00A3FF] text-white font-medium text-xs sm:text-sm hover:bg-[#0082CC] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit
            </button>
          ) : (
            <div className="text-xs sm:text-sm text-white/50 italic bg-white/5 p-2.5 sm:p-3 md:p-4 rounded-lg sm:rounded-xl">
              {textValue}
            </div>
          )}
        </div>
      ) : (
        // Basic fallback / Likert - dynamic scale based on question.scaleType
        <div className="space-y-2 sm:space-y-3 md:space-y-4">
          <div className="flex justify-between text-[10px] sm:text-xs md:text-sm text-white/50">
            <span>{question.scaleLabels?.low || 'Low'}</span>
            <span>{question.scaleLabels?.high || 'High'}</span>
          </div>
          <div className={`grid gap-1 sm:gap-1.5 md:gap-2`} style={{ gridTemplateColumns: `repeat(${scalePoints.length}, minmax(0, 1fr))` }}>
            {scalePoints.map(val => (
              <button
                key={val}
                onClick={() => !isAnswered && onAnswer(val)}
                disabled={isAnswered}
                className={`aspect-square rounded-md sm:rounded-lg font-bold text-xs sm:text-sm md:text-base transition-all ${response === val
                  ? 'bg-[#00A3FF] text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DesktopCampaignPlayer;

