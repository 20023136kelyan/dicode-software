import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Menu, Search, Play, Check, Clock, ChevronLeft, ChevronRight, Activity, Globe, Building2, Sparkles, Bot, Shield, Users, Handshake, Heart, Lightbulb, MessageCircle, Layers, Star, Home, LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPublishedCampaigns,
  getVideo,
  setModuleVideoFinished,
  updateVideoProgress,
  incrementModuleQuestionProgress,
  saveCampaignResponse
} from '@/lib/firestore';
import { useUserEnrollmentsRealtime, useCampaignResponsesRealtime } from '@/hooks/useEnrollmentRealtime';
import type { Campaign, CampaignEnrollment } from '@/types';
import AICopilot from '@/components/shared/AICopilot';
import PeerComparison from '@/pages/employee/PeerComparison';
import { Skeleton } from '@/components/shared/Skeleton';
import confetti from 'canvas-confetti';

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

const EmployeeHome: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);

  // Real-time enrollments hook
  const { enrollments, isLoading: isLoadingEnrollments } = useUserEnrollmentsRealtime(user?.id || '');

  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [selectedCompetency, setSelectedCompetency] = useState<string>('All');
  const [inProgressOnly, setInProgressOnly] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'organization' | 'dicode'>('all');
  const [videoThumbnails, setVideoThumbnails] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [videoDurations, setVideoDurations] = useState<Record<string, number>>({});
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [currentVideoData, setCurrentVideoData] = useState<any>(null);
  const [videoAnswers, setVideoAnswers] = useState<Record<string, string | number | boolean>>({});
  const [videoMetadataMap, setVideoMetadataMap] = useState<Record<string, any>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const watchProgressRef = useRef<Record<string, number>>({});
  const [showComparisonCampaignId, setShowComparisonCampaignId] = useState<string | null>(null);
  const autoAdvanceTimeoutRef = useRef<number | null>(null);
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

  // Real-time responses hook for selected campaign (must be after selectedCampaignId declaration)
  const { responses: savedResponses } = useCampaignResponsesRealtime(
    selectedCampaignId || '',
    user?.id || ''
  );

  const resetToFeedView = () => {
    setSelectedVideoId(null);
    setSelectedCampaignId(null);
    setCurrentQuestionIndex(0);
  };


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

  useEffect(() => {
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        window.clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
    };
  }, []);

  const trackVideoProgress = async (
    campaignId: string,
    videoId: string,
    watchedDuration: number,
    totalDuration: number
  ) => {
    if (!user || !totalDuration) return;
    try {
      await updateVideoProgress(
        campaignId,
        user.id,
        videoId,
        user.organization || '',
        watchedDuration,
        totalDuration
      );
    } catch (error) {
      console.error('Failed to record video watch progress:', error);
    }
  };

  const handleVideoCompleted = async (
    campaignId: string,
    itemId: string,
    questionTarget: number,
    watchedDuration?: number,
    totalDuration?: number,
    videoId?: string
  ) => {
    if (!user) return;
    try {
      if (videoId && watchedDuration !== undefined && totalDuration !== undefined) {
        await trackVideoProgress(campaignId, videoId, watchedDuration, totalDuration);
      }

      await setModuleVideoFinished(campaignId, user.id, itemId, {
        questionTarget,
        watchedDuration,
        totalDuration,
      });

      // Trigger confetti after marking video as finished
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Progress will update automatically via real-time listener
    } catch (error) {
      console.error('Failed to mark video as finished:', error);
    }
  };

  const handleAnswerSubmit = async (
    campaignId: string,
    videoId: string,
    itemId: string,
    answers: Record<string, string | number | boolean>
  ) => {
    if (!user) return;

    try {
      // Save each answer
      const questions = currentVideoData?.questions || [];
      const entriesToSave = Object.entries(answers).filter(
        ([questionId]) => !savedResponses[questionId]
      );
      const promises = entriesToSave.map(async ([questionId, answer]) => {
        const question = questions.find((q: any) => (q.id || `q-${questions.indexOf(q)}`) === questionId);

        // Save response
        await saveCampaignResponse(
          campaignId,
          videoId,
          questionId,
          user.id,
          user.organization || '',
          answer,
          {
            questionType: question?.type || 'text',
            questionText: question?.text || 'Question'
          }
        );

        // Increment progress
        await incrementModuleQuestionProgress(
          campaignId,
          user.id,
          itemId,
          questions.length,
          1,
          questionId
        );
      });

      await Promise.all(promises);

      // Progress will update automatically via real-time listener
      setShowComparisonCampaignId(campaignId);
      // Close video player after short delay
      setTimeout(() => {
        setSelectedVideoId(null);
      }, 500);

    } catch (error) {
      console.error('Failed to submit answers:', error);
    }
  };

  // Convert campaigns to module format
  const campaignModules = useMemo(() => {
    return campaigns.map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      duration: `${campaign.items.length} videos`,
      competencies: campaign.metadata.tags || [campaign.skillFocus],
      totalVideos: campaign.items.length,
      source: campaign.source || 'organization',
      items: campaign.items, // Include items for thumbnail access
      endDate: campaign.schedule?.endDate, // Include end date for display
    }));
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
      };
    });
  }, [modules, enrollments]);

  useEffect(() => {
    if (!competencyFilters.includes(selectedCompetency)) {
      setSelectedCompetency('All');
    }
  }, [competencyFilters, selectedCompetency]);

  // Fetch video thumbnails and durations for campaigns
  useEffect(() => {
    setShowComparisonCampaignId(null);
  }, [selectedCampaignId]);

  useEffect(() => {
    const fetchVideoData = async () => {
      const thumbnailMap: Record<string, string> = {};
      const durationMap: Record<string, number> = {};
      const metadataMap: Record<string, any> = {};

      for (const module of modulesWithProgress) {
        if (module.items) {
          let totalDuration = 0;

          // Fetch all videos for duration calculation
          for (const item of module.items) {
            if (item.videoId) {
              try {
                const videoData = await getVideo(item.videoId);
                if (videoData) {
                  // Store video metadata
                  metadataMap[item.videoId] = videoData;

                  // Calculate duration: video seconds + 1 min per question (assume 3 questions)
                  const videoDuration = videoData.duration || 0;
                  const questionCount = Array.isArray(videoData.questions) ? videoData.questions.length : 0;
                  totalDuration += videoDuration + (questionCount * 60);

                  // Store thumbnail for in-progress next video
                  if (module.status === 'in-progress' && !module.completed &&
                    module.items[module.nextVideoIndex]?.videoId === item.videoId &&
                    videoData.thumbnailUrl) {
                    thumbnailMap[module.id] = videoData.thumbnailUrl;
                  }
                }
              } catch (error) {
                console.error(`Failed to fetch video data for ${item.videoId}:`, error);
              }
            }
          }

          durationMap[module.id] = totalDuration;
        }
      }

      setVideoThumbnails(thumbnailMap);
      setVideoDurations(durationMap);
      setVideoMetadataMap(metadataMap);
    };

    if (modulesWithProgress.length > 0) {
      fetchVideoData();
    }
  }, [modulesWithProgress]);

  // Fetch current video data when video is selected
  useEffect(() => {
    const fetchCurrentVideo = async () => {
      if (!selectedVideoId || !selectedCampaignId) {
        setCurrentVideoData(null);
        setVideoAnswers({});
        return;
      }

      try {
        const videoData = await getVideo(selectedVideoId);
        console.log('Fetched video data:', videoData);
        console.log('Video has questions:', videoData?.questions);
        setCurrentVideoData(videoData);

        // Pre-fill answers from saved responses
        const preFilledAnswers: Record<string, string | number | boolean> = {};
        if (videoData?.questions && Array.isArray(videoData.questions)) {
          videoData.questions.forEach((question: any, index: number) => {
            const questionId = question.id || `q-${index}`;
            const savedResponse = savedResponses[questionId];
            if (savedResponse) {
              preFilledAnswers[questionId] = savedResponse.answer;
            }
          });
        }
        setVideoAnswers(preFilledAnswers);
      } catch (error) {
        console.error('Failed to fetch video:', error);
        setCurrentVideoData(null);
        setVideoAnswers({});
      }
    };

    fetchCurrentVideo();
  }, [selectedVideoId, selectedCampaignId, savedResponses]);

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

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const modules = filteredModulesWithProgress;
        if (modules.length === 0) return;

        const currentIndex = modules.findIndex(m => m.id === selectedCampaignId);
        let nextIndex = 0;

        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, modules.length - 1);
        } else {
          nextIndex = currentIndex === -1 ? modules.length - 1 : Math.max(currentIndex - 1, 0);
        }

        setSelectedCampaignId(modules[nextIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredModulesWithProgress, selectedCampaignId]);

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

  const handleModuleCardClick = (moduleId: string, forceNavigate = false) => {
    const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 1024 : false;
    if (forceNavigate || !isDesktop) {
      navigate(`/employee/campaign/${moduleId}`);
      return;
    }
    setSelectedCampaignId(moduleId);
    setSelectedVideoId(null);
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

    const totalSeconds = videoDurations[module.id] || 0;
    const durationMinutes = Math.ceil(totalSeconds / 60);
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
    if (isLoadingCampaigns || isLoadingEnrollments) {
      return (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 py-6">
          <div className="space-y-8">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-8 w-48 bg-white/10" />
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="bg-[#090909] rounded-2xl border border-white/5 p-4 space-y-4">
                      <div className="flex gap-4">
                        <Skeleton className="w-24 h-16 rounded-lg flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (!sections.length) {
      return (
        <div className="flex-1 flex items-center justify-center text-center px-8">
          <div>
            <BookOpen size={48} className="text-white/20 mx-auto mb-4" />
            <h3 className="text-white text-2xl font-semibold mb-2">No campaigns available</h3>
            <p className="text-white/60">Adjust your filters or check back later for new learning programs.</p>
          </div>
        </div>
      );
    }

    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 overflow-y-auto custom-scrollbar pr-4 py-6"
      >
        {/* Continue Learning Hero */}
        {inProgressModules.length > 0 && !searchQuery && !selectedCompetency && sourceFilter === 'all' && (
          <div className="mb-8">
            <div className="relative overflow-hidden rounded-3xl bg-[#090909] border border-white/10 p-6 md:p-8">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-50" />
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                    <Activity size={14} />
                    <span>Continue Learning</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white">
                    {inProgressModules[0].title}
                  </h2>
                  <p className="text-white/60 line-clamp-1">
                    {inProgressModules[0].description}
                  </p>
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex-1 max-w-xs h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${inProgressModules[0].completionPercentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-white/60">{inProgressModules[0].completionPercentage}% complete</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCampaignId(inProgressModules[0].id)}
                  className="flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold hover:bg-white/90 transition-all active:scale-95"
                >
                  <Play size={18} fill="currentColor" />
                  <span>Jump back in</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {sections.map((section) => {
            const isCarousel = section.layout === 'carousel';
            return (
              <div key={section.title} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-white text-lg font-semibold">{section.title}</h2>
                </div>
                <motion.div
                  layout
                  className={
                    isCarousel
                      ? 'flex gap-6 overflow-x-auto overflow-visible scrollbar-hide pb-2'
                      : 'grid gap-6 md:grid-cols-2 xl:grid-cols-3'
                  }
                >
                  {section.data.map((module) => (
                    <div className={isCarousel ? 'min-w-[320px] flex-shrink-0' : ''} key={module.id}>
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
        <div className="flex flex-col items-center justify-center py-20 text-center">
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
                : 'grid gap-4 md:grid-cols-2'
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

  const renderLearningArea = () => {
    const showFilters = modulesWithProgress.length > 0;
    const navItemClasses = (isActive: boolean) =>
      `w-full flex items-center gap-3 px-3 py-2 rounded-2xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090909] ${isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
      }`;

    const filterSidebar = showFilters ? (
      <div className="w-64 flex-shrink-0 sticky top-2 self-start pl-2">
        <nav className="space-y-6 text-white">


          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Competencies</p>
            <div className="mt-3 space-y-1">
              {competencyFilters.map((competency) => {
                const isActive = selectedCompetency === competency;
                const Icon = competencyStyles[competency]?.icon || Shield;
                return (
                  <button
                    key={competency}
                    onClick={() => {
                      setSelectedCompetency(competency);
                      resetToFeedView();
                    }}
                    className={navItemClasses(isActive)}
                  >
                    <Icon size={16} className={isActive ? 'text-white' : 'text-white/40'} />
                    <span className={`truncate text-sm font-medium ${isActive ? 'text-white' : 'text-white/60'}`}>
                      {competency || 'Unnamed'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-white/10" />

          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Status</p>
            <div className="mt-3 space-y-1">
              <button
                onClick={() => {
                  setInProgressOnly((prev) => !prev);
                  resetToFeedView();
                }}
                className={navItemClasses(inProgressOnly)}
              >
                <Activity size={16} className={inProgressOnly ? 'text-white' : 'text-white/40'} />
                <span className={`text-sm font-medium ${inProgressOnly ? 'text-white' : 'text-white/60'}`}>
                  In Progress
                </span>
              </button>
            </div>
          </div>

          <div className="h-px bg-white/10" />

          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Source</p>
            <div className="mt-3 space-y-1">
              {sourceFilterOptions.map((option) => {
                const isActive = sourceFilter === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSourceFilter(option.value);
                      resetToFeedView();
                    }}
                    className={navItemClasses(isActive)}
                  >
                    <Icon size={16} className={isActive ? 'text-white' : 'text-white/40'} />
                    <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-white/60'}`}>
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-white/10" />

          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Assistant</p>
            <div className="mt-3">
              <button
                onClick={() => setIsCopilotOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/5 text-sm font-semibold text-white hover:bg-white/10 transition-all"
              >
                <Bot size={18} className="text-white" />
                <span>DiCode Copilot</span>
              </button>
            </div>
          </div>

          <div className="h-px bg-white/10" />

          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Account</p>
            <div className="mt-3">
              <button
                onClick={() => logout()}
                className={navItemClasses(false)}
              >
                <LogOut size={16} className="text-white/40" />
                <span className="truncate text-sm font-medium text-white/60">
                  Log Out
                </span>
              </button>
            </div>
          </div>
        </nav>
      </div>
    ) : null;

    if (!selectedCampaignId) {
      const feedContent = renderDesktopHomeFeed();
      if (!filterSidebar) {
        return (
          <AnimatePresence mode="wait">
            <motion.div
              key="feed-no-sidebar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 bg-[#090909] rounded-3xl border border-white/5 p-4 overflow-hidden"
            >
              {feedContent}
            </motion.div>
          </AnimatePresence>
        );
      }
      return (
        <AnimatePresence mode="wait">
          <motion.div
            key="feed-with-sidebar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 bg-[#090909] rounded-3xl border border-white/5 p-4 overflow-hidden"
          >
            <div className="h-full flex gap-6 overflow-hidden">
              {filterSidebar}
              {feedContent}
            </div>
          </motion.div>
        </AnimatePresence>
      );
    }

    const content = (() => {
      if (showComparisonCampaignId === selectedCampaignId) {
        return (
          <motion.div
            key="peer-comparison"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="flex-1 bg-[#090909] rounded-3xl border border-white/5 overflow-hidden p-4 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Peer comparison</p>
                <h3 className="text-white text-lg font-semibold">See how your answers stack up</h3>
              </div>
              <button
                onClick={() => setShowComparisonCampaignId(null)}
                className="inline-flex items-center gap-2 px-3 h-10 rounded-full bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
              >
                Back to modules
              </button>
            </div>
            <PeerComparison campaignIdOverride={selectedCampaignId} embedded />
          </motion.div>
        );
      }

      if (selectedVideoId && currentVideoData) {
        const questions =
          (currentVideoData.questions && Array.isArray(currentVideoData.questions) && currentVideoData.questions.length > 0)
            ? currentVideoData.questions
            : (videoMetadataMap[selectedVideoId]?.questions && Array.isArray(videoMetadataMap[selectedVideoId].questions))
              ? videoMetadataMap[selectedVideoId].questions
              : [];
        const questionCount = questions.length;
        const handleTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement, Event>) => {
          if (!selectedVideoId) return;
          const current = (event.currentTarget.currentTime || 0);
          watchProgressRef.current[selectedVideoId] = Math.max(
            watchProgressRef.current[selectedVideoId] || 0,
            current
          );
        };

        const getQuestionText = (q: any) => q.text || q.statement || q.question || 'Untitled Question';
        const getQuestionType = (q: any, index: number) => {
          const type = (q.type || '').toLowerCase();
          if (index < 2 && !type) return 'scale';
          if (type.includes('choice') || type.includes('select') || q.options?.length) return 'multiple-choice';
          if (type.includes('scale') || type.includes('likert') || q.scaleMax) return 'scale';
          if (index < 2) return 'scale';
          return 'text';
        };

        return (
          <motion.div
            key="video-module"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col space-y-1 overflow-hidden"
          >
            <div className="space-y-1 flex-shrink-0">
              <div className="relative aspect-video bg-black rounded-3xl overflow-hidden">
                {currentVideoData.storageUrl ? (
                  <video
                    src={currentVideoData.storageUrl}
                    controls
                    className="w-full h-full object-contain bg-black"
                    poster={currentVideoData.thumbnailUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={(event) => {
                      if (selectedCampaignId && selectedVideoId) {
                        const campaign = campaigns.find(c => c.id === selectedCampaignId);
                        const item = campaign?.items.find(i => i.videoId === selectedVideoId);
                        if (item) {
                          const totalDuration =
                            event.currentTarget.duration ||
                            currentVideoData?.duration ||
                            0;
                          const watchedDuration = Math.max(
                            watchProgressRef.current[selectedVideoId] || 0,
                            event.currentTarget.currentTime || 0
                          );

                          handleVideoCompleted(
                            selectedCampaignId,
                            item.id,
                            questionCount,
                            watchedDuration,
                            totalDuration,
                            selectedVideoId
                          );
                          if (questionCount === 0) {
                            setShowComparisonCampaignId(selectedCampaignId);
                          }
                        }
                      }
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Play size={64} className="text-white/20 mx-auto mb-4" />
                      <p className="text-white/40">Video not available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {questions.length > 0 && (
              <div className="rounded-3xl p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white text-xl font-bold">
                      Question {currentQuestionIndex + 1} of {questions.length}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (currentQuestionIndex > 0) {
                            setCurrentQuestionIndex(prev => prev - 1);
                          } else {
                            setSelectedVideoId(null);
                          }
                        }}
                        className="flex items-center gap-2 px-4 h-10 rounded-full bg-white/10 text-white font-medium hover:bg-white/15 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090909]"
                        title={currentQuestionIndex === 0 ? 'Back to modules' : 'Previous'}
                      >
                        <ChevronLeft size={18} />
                        <span className="uppercase tracking-wide text-xs">
                          {currentQuestionIndex === 0 ? 'Back' : 'Previous'}
                        </span>
                      </button>

                      {currentQuestionIndex < questions.length - 1 ? (
                        <button
                          onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                          disabled={(() => {
                            const q = questions[currentQuestionIndex];
                            return q.isRequired && !videoAnswers[q.id || `q-${currentQuestionIndex}`];
                          })()}
                          className="flex items-center gap-2 px-4 h-10 rounded-full bg-white text-black font-semibold uppercase tracking-wide text-xs hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090909]"
                        >
                          <span>Next</span>
                          <ChevronRight size={18} />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (selectedCampaignId && selectedVideoId) {
                              const campaign = campaigns.find(c => c.id === selectedCampaignId);
                              const item = campaign?.items.find(i => i.videoId === selectedVideoId);
                              if (item) {
                                handleAnswerSubmit(selectedCampaignId, selectedVideoId, item.id, videoAnswers);
                              }
                            }
                          }}
                          disabled={questions.some((q: any) => q.isRequired && !videoAnswers[q.id || `q-${questions.indexOf(q)}`])}
                          className="flex items-center gap-2 px-4 h-10 rounded-full bg-white text-black font-semibold uppercase tracking-wide text-xs hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090909]"
                        >
                          <span>Submit</span>
                          <ChevronRight size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-px bg-white/10 rounded-full mb-6">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-300"
                      style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {(() => {
                  const question = questions[currentQuestionIndex];
                  const questionId = question.id || `q-${currentQuestionIndex}`;
                  const savedResponse = savedResponses[questionId];
                  const isReadOnly = !!savedResponse;
                  const userAnswer = videoAnswers[questionId];
                  const questionText = getQuestionText(question);
                  const answered = !!savedResponse;
                  const questionType = getQuestionType(question, currentQuestionIndex);

                  return (
                    <div key={questionId} className="space-y-6">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-semibold">{currentQuestionIndex + 1}</span>
                        </div>
                        <div className="flex-1 flex items-start gap-2">
                          <h4 className="text-white font-semibold text-lg flex items-center gap-2">
                            {questionText} {question.isRequired && <span className="text-red-400">*</span>}
                            {answered && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs text-white/70">
                                <Check size={12} />
                                Answered
                              </span>
                            )}
                          </h4>
                        </div>
                      </div>

                      {questionType === 'multiple-choice' && question.options && (
                        <div className={`space-y-2 ml-11 ${answered ? 'opacity-50' : ''}`}>
                          {question.options.map((option: string, oIndex: number) => (
                            <label
                              key={oIndex}
                              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${userAnswer === option
                                ? 'bg-white/15 border-2 border-white/30'
                                : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                                }`}
                            >
                              <input
                                type="radio"
                                name={questionId}
                                value={option}
                                checked={userAnswer === option}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                  if (isReadOnly) return;
                                  setVideoAnswers(prev => ({ ...prev, [questionId]: e.target.value }));
                                }}
                                className="w-4 h-4 text-primary"
                              />
                              <span className="text-white text-sm">{option}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {questionType === 'scale' && (
                        <div className={`ml-11 ${answered ? 'opacity-50' : ''}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white/60 text-xs">{question.scaleMin || 1}</span>
                            <span className="text-white/60 text-xs">{question.scaleMax || 5}</span>
                          </div>
                          <div className="flex gap-2">
                            {Array.from({ length: (question.scaleMax || 5) - (question.scaleMin || 1) + 1 }, (_, i) => {
                              const value = (question.scaleMin || 1) + i;
                              return (
                                <button
                                  key={value}
                                  disabled={isReadOnly}
                                  onClick={() => {
                                    if (isReadOnly) return;
                                    setVideoAnswers(prev => ({ ...prev, [questionId]: value }));
                                    if (currentQuestionIndex < questions.length - 1) {
                                      if (autoAdvanceTimeoutRef.current) {
                                        window.clearTimeout(autoAdvanceTimeoutRef.current);
                                      }
                                      autoAdvanceTimeoutRef.current = window.setTimeout(() => {
                                        setCurrentQuestionIndex((prev) =>
                                          Math.min(prev + 1, questions.length - 1)
                                        );
                                        autoAdvanceTimeoutRef.current = null;
                                      }, 400);
                                    }
                                  }}
                                  className={`flex-1 py-3 rounded-xl font-semibold transition-all ${userAnswer === value
                                    ? 'bg-white text-black'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                    }`}
                                >
                                  {value}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {questionType === 'text' && (
                        <div className={`ml-11 ${answered ? 'opacity-50' : ''}`}>
                          <textarea
                            value={(userAnswer as string) || ''}
                            onChange={(e) => {
                              if (isReadOnly) return;
                              setVideoAnswers(prev => ({ ...prev, [questionId]: e.target.value }));
                            }}
                            placeholder="Type your answer here..."
                            rows={4}
                            disabled={isReadOnly}
                            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </motion.div>
        );
      }

      return (
        <motion.div
          key="campaign-details"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex items-end justify-center text-center px-6 pb-10"
        >
          {(() => {
            const campaign = selectedCampaignId
              ? campaigns.find((c) => c.id === selectedCampaignId)
              : null;
            const totalSeconds = campaign ? videoDurations[selectedCampaignId] || 0 : 0;
            const durationMinutes = totalSeconds > 0 ? Math.ceil(totalSeconds / 60) : null;
            const endDate = campaign?.schedule?.endDate
              ? new Date(campaign.schedule.endDate)
              : null;
            const endDateLabel = endDate
              ? endDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
              : 'No end date';
            const modulesCount = campaign?.items?.length ?? 0;
            return (
              <div className="relative max-w-5xl w-full overflow-hidden min-h-[82vh] flex items-end bg-transparent rounded-[32px]">
                {(() => {
                  const firstVideoId = campaign?.items?.[0]?.videoId;
                  const heroThumb =
                    (firstVideoId && videoMetadataMap[firstVideoId]?.thumbnailUrl) ||
                    (selectedCampaignId ? videoThumbnails[selectedCampaignId] : undefined);
                  return heroThumb ? (
                    <>
                      <div
                        className="absolute inset-0 bg-cover bg-center filter blur-xl scale-110 opacity-50 pointer-events-none"
                        style={{ backgroundImage: `url(${heroThumb})` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/65 pointer-events-none" />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/50 to-black/65 pointer-events-none" />
                  );
                })()}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <BookOpen size={96} className="text-white/10" />
                </div>
                <div className="relative p-10 md:p-14 space-y-5 text-left w-full">
                  <div className="flex items-center gap-3 text-white/70 text-xs uppercase tracking-[0.35em]">
                    <BookOpen size={18} />
                    <span>{selectedCampaignId ? 'Campaign ready' : 'Select a campaign to begin'}</span>
                  </div>
                  <h3 className="text-white text-4xl md:text-5xl font-semibold leading-tight">
                    {campaign?.title || 'Pick a module to begin'}
                  </h3>
                  {campaign?.description && (
                    <p className="text-white/70 text-base md:text-lg leading-relaxed max-w-3xl">
                      {campaign.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm text-white/70">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      <span className="text-white/60">End date</span>
                      <span className="text-white">{endDateLabel}</span>
                    </span>
                    {durationMinutes !== null && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                        <span className="text-white/60">Est. time</span>
                        <span className="text-white">{durationMinutes} min</span>
                      </span>
                    )}
                    {modulesCount > 0 && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                        <span className="text-white/60">Modules</span>
                        <span className="text-white">{modulesCount}</span>
                      </span>
                    )}
                  </div>
                  <div className="pt-2">
                    <p className="text-white/80 text-sm md:text-base font-medium">
                      {selectedCampaignId
                        ? 'Choose a module from the sidebar to load its video lesson and assessment.'
                        : 'Choose a campaign from the sidebar to see its modules and start learning.'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </motion.div>
      );
    })();

    if (!filterSidebar) {
      return (
        <AnimatePresence mode="wait">
          <motion.div
            key="split-view-no-sidebar"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 bg-[#090909] rounded-3xl border border-white/5 p-4 overflow-hidden"
          >
            <AnimatePresence mode="wait">
              {content}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      );
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="split-view-with-sidebar"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="flex-1 bg-[#090909] rounded-3xl border border-white/5 p-4 overflow-hidden"
        >
          <div className="h-full flex gap-4 overflow-hidden">
            {filterSidebar}
            <AnimatePresence mode="wait">
              {content}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  };
  const renderCampaignSidebar = () => {
    const renderLoadingState = (
      <div className="p-4 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-white/5 p-4 space-y-3">
            <div className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );

    const renderEmptyState = (
      <div className="p-6 text-center text-white/50 text-sm">
        No campaigns match your filters yet.
      </div>
    );

    const sidebarContent = () => {
      if (isLoadingCampaigns || isLoadingEnrollments) return renderLoadingState;
      if (filteredModulesWithProgress.length === 0) return renderEmptyState;

      return (
        <div className="p-4 space-y-4">
          {filteredModulesWithProgress.map((module) => {
            const isSelected = selectedCampaignId === module.id;

            const thumbnail = videoThumbnails[module.id];
            const campaignData = campaigns.find((c) => c.id === module.id);
            if (!campaignData) return null;

            const enrollment = enrollments.find(e => e.campaignId === module.id);
            const moduleProgressMap = enrollment?.moduleProgress || {};
            const completedModules =
              enrollment?.completedModules ??
              Object.values(moduleProgressMap).filter((m) => m.completed).length;
            const progress =
              module.totalVideos === 0 ? 0 : Math.round((completedModules / module.totalVideos) * 100);
            const hasStarted =
              Object.keys(moduleProgressMap).length > 0 ||
              enrollment?.status === 'in-progress' ||
              enrollment?.status === 'completed';
            const isComplete = module.totalVideos > 0 && completedModules >= module.totalVideos;
            const firstIncompleteIndex = campaignData.items.findIndex(
              (item) => !moduleProgressMap[item.id]?.completed
            );
            const totalSeconds = videoDurations[module.id] || 0;
            const durationMinutes = Math.ceil(totalSeconds / 60);

            const hasProgress = module.completionPercentage > 0;

            return (
              <motion.div
                layout
                key={module.id}
                className="overflow-hidden rounded-3xl"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isSelected ? (
                    <motion.div
                      key="expanded"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="space-y-4"
                    >
                      <div className="relative overflow-hidden rounded-3xl text-white shadow-2xl">
                        {thumbnail ? (
                          <>
                            <div
                              className="absolute inset-0 bg-cover bg-center"
                              style={{ backgroundImage: `url(${thumbnail})` }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0b1324] via-[#0b1324]/80 to-transparent" />
                          </>
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-[#0b1324] via-[#152b55] to-[#1d4ed8]" />
                        )}
                        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.7),_transparent_60%)] pointer-events-none" />
                        <div className="relative p-6 space-y-6">
                          <div>
                            <p className="text-xs uppercase tracking-[0.35em] text-white/60 mb-2">Campaign</p>
                            <h2 className="text-2xl font-semibold leading-tight">{module.title}</h2>
                          </div>

                          <div className="w-full">
                            <div className="flex items-baseline justify-between text-white gap-4">
                              <p className="text-sm text-white/70">
                                {isComplete ? 'Completed' : hasStarted ? 'In progress' : 'Not started'}
                              </p>
                              {hasStarted && <span className="text-2xl font-semibold">{progress}%</span>}
                            </div>
                            {hasStarted && (
                              <div className="mt-3 h-2 rounded-full bg-white/20 overflow-hidden w-full">
                                <div
                                  className="h-full rounded-full bg-white"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-white/80">
                            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.3em]">
                              <BookOpen size={16} />
                              <span className="text-white">{module.totalVideos}</span>
                            </div>
                            {durationMinutes > 0 && (
                              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.3em]">
                                <Clock size={16} />
                                <span className="text-white">{durationMinutes} mins</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                        className="space-y-1 pl-2"
                      >
                        {campaignData.items.map((item, index) => {
                          const moduleState = moduleProgressMap[item.id];
                          const completed = !!moduleState?.completed;
                          const videoMeta = videoMetadataMap[item.videoId];
                          const moduleTitle = videoMeta?.title || `Module ${index + 1}`;
                          const moduleDescription = videoMeta?.description || 'Video Lesson';
                          const questionCount = videoMeta?.questions
                            ? Array.isArray(videoMeta.questions)
                              ? videoMeta.questions.length
                              : 0
                            : 3;
                          const moduleDurationMinutes = videoMeta?.duration
                            ? Math.ceil(videoMeta.duration / 60) + questionCount
                            : 5 + questionCount;
                          const moduleDurationLabel = `${moduleDurationMinutes} mins`;
                          const progressRatio = moduleState
                            ? ((moduleState.videoFinished ? 1 : 0) +
                              Math.min(moduleState.questionsAnswered, moduleState.questionTarget)) /
                            (moduleState.questionTarget + 1)
                            : 0;
                          const moduleProgressPercent = Math.round(progressRatio * 100);
                          const isCurrent = !completed && firstIncompleteIndex === index && !isComplete;
                          const isLocked = !completed && firstIncompleteIndex !== -1 && index > firstIncompleteIndex;

                          const isSelectedVideo = selectedVideoId === item.videoId;

                          const CircularProgress = () => (
                            <div className="relative w-10 h-10">
                              <svg className="transform -rotate-90" viewBox="0 0 36 36">
                                <path
                                  className={isSelectedVideo ? "text-black/10" : "text-white/20"}
                                  strokeWidth="4"
                                  stroke="currentColor"
                                  fill="none"
                                  strokeLinecap="round"
                                  d="M18 2.0845
                                     a 15.9155 15.9155 0 0 1 0 31.831
                                     a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path
                                  className={isSelectedVideo ? "text-black" : "text-white"}
                                  strokeWidth="4"
                                  strokeDasharray={`${moduleProgressPercent}, 100`}
                                  stroke="currentColor"
                                  fill="none"
                                  strokeLinecap="round"
                                  d="M18 2.0845
                                     a 15.9155 15.9155 0 0 1 0 31.831
                                     a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-xs font-semibold ${isSelectedVideo ? 'text-black' : 'text-white'}`}>{moduleProgressPercent}%</span>
                              </div>
                            </div>
                          );

                          if (isCurrent) {
                            return (
                              <div
                                key={item.id}
                                onClick={() => setSelectedVideoId(item.videoId)}
                                className={`border rounded-3xl p-5 cursor-pointer active:scale-[0.98] transition-all ${isSelectedVideo
                                  ? 'bg-white border-white text-black shadow-lg scale-[1.02]'
                                  : 'bg-white/10 border-white/20 text-white hover:bg-white/15'
                                  }`}
                              >
                                <div className="flex items-start gap-3 mb-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${isSelectedVideo ? 'bg-black/10 text-black' : 'bg-white/10 text-white'
                                    }`}>
                                    {index + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-xs uppercase tracking-[0.3em] mb-1 ${isSelectedVideo ? 'text-black/50' : 'text-white/50'
                                      }`}>In Progress</p>
                                    <h3 className="text-lg font-semibold truncate">{moduleTitle}</h3>
                                    <p className={`text-sm truncate ${isSelectedVideo ? 'text-black/60' : 'text-white/60'
                                      }`}>{moduleDescription} • {moduleDurationLabel}</p>
                                  </div>
                                  <CircularProgress />
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={item.id}
                              onClick={() => !isLocked && setSelectedVideoId(item.videoId)}
                              className={`py-4 flex items-center justify-between gap-4 px-4 rounded-xl transition-all ${isSelectedVideo
                                ? 'bg-white text-black shadow-lg scale-[1.02]'
                                : `${completed ? 'text-white' : 'text-white/60'} ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-white/5 active:scale-[0.98]'
                                } ${index % 2 === 0 ? 'bg-white/5' : 'bg-transparent'}`
                                }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${isSelectedVideo ? 'bg-black/10 text-black' : 'bg-white/10 text-white'
                                  }`}>
                                  {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className={`text-sm font-semibold truncate ${isSelectedVideo ? 'text-black' : 'text-white'
                                    }`}>{moduleTitle}</h3>
                                  <p className={`text-xs truncate ${isSelectedVideo ? 'text-black/40' : 'text-white/40'
                                    }`}>{moduleDescription} • {moduleDurationLabel}</p>
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                {completed ? (
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSelectedVideo ? 'bg-green-600 text-white' : 'bg-green-500 text-white'
                                    }`}>
                                    <Check size={18} />
                                  </div>
                                ) : (
                                  <CircularProgress />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="collapsed"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      onClick={() => {
                        setSelectedCampaignId(module.id);
                        setSelectedVideoId(null);
                        setShowComparisonCampaignId(null);
                      }}
                      className="relative overflow-hidden rounded-2xl border border-white/10 bg-transparent p-4 hover:border-white/30 active:scale-[0.98] transition-all cursor-pointer w-full text-left block"
                    >
                      {thumbnail ? (
                        <>
                          <div
                            className="absolute inset-0 bg-cover bg-center opacity-40"
                            style={{ backgroundImage: `url(${thumbnail})` }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1324] via-[#0b1324]/80 to-transparent" />
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1324] via-[#152b55] to-[#1d4ed8]" />
                      )}
                      <div className="relative z-10 flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-xs uppercase tracking-[0.35em] text-white/60 mb-1">Campaign</p>
                          <h2 className="text-lg font-semibold text-white leading-tight">{module.title}</h2>
                        </div>
                        <div className="flex-shrink-0">
                          {hasProgress && (
                            <div>
                              <div className="flex justify-between text-xs text-white/60 mb-1.5">
                                <span>Progress</span>
                                <span>{module.completionPercentage}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-white"
                                  style={{ width: `${module.completionPercentage}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div >
      );
    };

    return (
      <div className="w-96 flex flex-col">
        <div className="flex-1 overflow-y-auto">{sidebarContent()}</div>
      </div>
    );
  };

  // Mobile view (existing)
  const renderMobileView = () => (
    <div className="min-h-screen bg-[#050608] flex flex-col lg:hidden">
      {/* Header */}
      <div className="employee-header pt-6 px-6 pb-10">
        <div className="flex items-center justify-between mb-0 relative">
          <div className="flex items-center gap-4">
            <img src="/dicode_logo.png" alt="DiCode" className="h-16 w-auto" />
            <div>
              <p className="text-sm text-white/60">Hello, {user?.name.split(' ')[0]}</p>
              <h1 className="text-2xl font-semibold text-white leading-tight">
                Your Campaigns
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/employee/profile')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <span className="sr-only">Open profile menu</span>
              <Menu size={24} className="text-white" />
            </button>
          </div>
        </div>

        {modules.length > 0 && (
          <div className="mt-6">
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  resetToFeedView();
                }}
                placeholder="Search campaigns..."
                className="pl-9 pr-4 py-2 rounded-full bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 w-full"
              />
            </div>
            <div className="-mx-6 mb-6">
              <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide py-4 px-6">
                {competencyFilters.map((competency) => (
                  <button
                    key={competency}
                    onClick={() => setSelectedCompetency(competency)}
                    className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${selectedCompetency === competency
                      ? 'bg-white text-gray-900'
                      : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                  >
                    {competency}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modules List */}
      <div className="px-6 pb-20 flex-1 flex flex-col">
        {isLoadingCampaigns || isLoadingEnrollments ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-white/70 text-sm">Loading your campaigns...</div>
          </div>
        ) : modules.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="card card--no-border text-center py-12">
              <div className="w-16 h-16 bg-blue-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen size={32} className="text-blue-primary" />
              </div>
              <h3 className="text-xl font-semibold text-dark-text mb-2">No Campaigns Available</h3>
              <p className="text-dark-text-muted">
                No learning campaigns have been assigned to you yet. Check back later or contact your administrator.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 flex-1 -mt-12">
            {renderSections()}
          </div>
        )}
      </div>
    </div>
  );

  const renderDesktopView = () => {
    return (
      <div className="hidden lg:flex flex-col h-screen overflow-hidden bg-[#050608]">
        {/* Top Bar */}
        <div className="h-20 flex-shrink-0 flex items-center justify-between px-6 bg-[#050608]">
          <div className="flex-1 flex justify-start">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <img src="/dicode_logo.png" alt="DiCode" className="h-10 w-auto" />
                <div className="h-6 w-px bg-white/10 mx-2"></div>
                <div>
                  <p className="text-sm text-white/70">Hello, {user?.name.split(' ')[0]}</p>
                  <h1 className="text-lg font-bold text-white tracking-wide">Your Campaigns</h1>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-xl mx-4 flex justify-center items-center gap-3">
            {(selectedCampaignId || selectedVideoId) && (
              <button
                onClick={resetToFeedView}
                className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all flex-shrink-0"
                title="Back to feed"
              >
                <Home size={18} />
              </button>
            )}
            <div className="relative w-full">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search your learning content..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  resetToFeedView();
                }}
                className="w-full pl-11 pr-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/10 focus:bg-white/10 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 flex justify-end items-center gap-4">
            <button
              onClick={() => navigate('/employee/profile')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <span className="sr-only">Open profile menu</span>
              <Menu size={24} className="text-white" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden p-1 gap-1">
          {renderLearningArea()}
          {selectedCampaignId && renderCampaignSidebar()}
        </div>
      </div>
    );
  };



  return (
    <>
      {renderMobileView()}
      {renderDesktopView()}

      {/* AI Copilot */}
      {isCopilotOpen && (
        <AICopilot
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          context={{ userRole: 'employee' }}
        />
      )}
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
