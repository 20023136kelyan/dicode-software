import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, ChevronUp, Loader, Check } from 'lucide-react';
import {
  getCampaign,
  getVideo,
  updateVideoProgress,
  saveCampaignResponse,
  updateEnrollmentAccess,
  checkUserEnrollment,
  enrollUserInCampaign,
  setModuleVideoFinished,
  incrementModuleQuestionProgress
} from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useCampaignResponsesRealtime } from '@/hooks/useEnrollmentRealtime';
import type { Campaign, Question } from '@/types';

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
}

type SlideType = 'video' | 'question';

interface Slide {
  id: string;
  type: SlideType;
  videoId: string;
  questionId?: string;
  content: VideoWithData | Question;
  index: number; // Global index in the feed
  itemId: string;
  questionTarget: number;
}

const VideoModule: React.FC = () => {
  const { moduleId } = useParams(); // This is campaignId
  const navigate = useNavigate();
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  // Campaign and video data
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Response type for Q2 SJT questions (moved here for state type)
  type ResponseValue = string | number | boolean | { selectedOptionId: string; intentScore: number };

  // Current state
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, ResponseValue>>({});
  const [savingResponse, setSavingResponse] = useState<string | null>(null); // composite key (videoId_questionId) being saved

  // Real-time responses hook
  const { responses: savedResponses } = useCampaignResponsesRealtime(
    campaign?.id || '',
    user?.id || ''
  );

  // Load campaign and videos
  useEffect(() => {
    let isMounted = true;

    const loadCampaignData = async () => {
      if (!moduleId || !user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        // Load campaign first to check if it's a DiCode campaign
        const campaignData = await getCampaign(moduleId);
        if (!isMounted) return;

        if (!campaignData) {
          setLoadError('Campaign not found');
          setIsLoading(false);
          return;
        }

        setCampaign(campaignData);

        // Check enrollment
        let enrollment = await checkUserEnrollment(moduleId, user.id);

        // For DiCode campaigns, user must already be enrolled (no auto-enrollment)
        if (!enrollment && campaignData.source === 'dicode') {
          setLoadError('You are not enrolled in this campaign');
          setIsLoading(false);
          return;
        }

        // For org campaigns, auto-enroll if needed (safety net)
        if (!enrollment) {
          await enrollUserInCampaign(moduleId, user.id, user.organization || '', 'system', true);
          enrollment = await checkUserEnrollment(moduleId, user.id);
        }

        // Update enrollment access
        await updateEnrollmentAccess(moduleId, user.id);

        // Load videos from campaign items
        if (campaignData.items.length === 0) {
          setLoadError('This campaign has no videos yet');
          setIsLoading(false);
          return;
        }

        // Sort items by order
        const sortedItems = [...campaignData.items].sort((a, b) => a.order - b.order);

        // Load video data for each item
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
          };
        });

        const videosData = (await Promise.all(videoDataPromises)).filter(Boolean) as VideoWithData[];

        if (!isMounted) return;

        if (videosData.length === 0) {
          setLoadError('Failed to load video content');
          setIsLoading(false);
          return;
        }

        // Build slides (Video -> Q1 -> Q2 -> Video 2 -> ...)
        const generatedSlides: Slide[] = [];
        let globalIndex = 0;
        
        // Track the first slide index for each module (by itemId)
        const moduleStartIndices: Record<string, number> = {};

        videosData.forEach((video) => {
          // Record the starting index for this module
          moduleStartIndices[video.itemId] = globalIndex;
          
          // Add Video Slide
          generatedSlides.push({
            id: `video-${video.id}`,
            type: 'video',
            videoId: video.id,
            content: video,
            itemId: video.itemId,
            questionTarget: video.questionTarget,
            index: globalIndex++,
          });

          // Add Question Slides (use video.id in key to make it unique across videos)
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

        // Find the first incomplete module to start from
        let startingSlideIndex = 0;
        if (enrollment?.moduleProgress) {
          // Find the first module that isn't completed
          for (const item of sortedItems) {
            const moduleState = enrollment.moduleProgress[item.id];
            if (!moduleState?.completed) {
              // Start from this module
              startingSlideIndex = moduleStartIndices[item.id] || 0;
              console.log(`📍 Starting from module ${item.id} at slide index ${startingSlideIndex}`);
              break;
            }
          }
        }

        setSlides(generatedSlides);
        setCurrentSlideIndex(startingSlideIndex);
        setIsLoading(false);
        
        // Scroll to the starting position after a brief delay to ensure DOM is ready
        if (startingSlideIndex > 0) {
          setTimeout(() => {
            if (containerRef.current) {
              containerRef.current.scrollTo({
                top: startingSlideIndex * containerRef.current.clientHeight,
                behavior: 'auto' // Use 'auto' for instant scroll on load
              });
            }
          }, 100);
        }

      } catch (error) {
        console.error('[VideoModule] Failed to load campaign:', error);
        if (isMounted) {
          setLoadError('Unable to load this campaign. Please try again later.');
          setIsLoading(false);
        }
      }
    };

    loadCampaignData();

    return () => {
      isMounted = false;
    };
  }, [moduleId, user]);

  // Handle Scroll Snap detection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const index = Math.round(container.scrollTop / container.clientHeight);
      if (index !== currentSlideIndex && index >= 0 && index < slides.length) {
        setCurrentSlideIndex(index);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [slides.length, currentSlideIndex]);

  // Pre-fill responses from saved responses when slides and savedResponses are ready
  // Fixed: reconstruct SJT object from metadata (same as Desktop)
  useEffect(() => {
    if (slides.length > 0 && Object.keys(savedResponses).length > 0) {
      // Pre-fill responses from Firestore
      const preFilledResponses: Record<string, ResponseValue> = {};
      slides.forEach((slide) => {
        if (slide.type === 'question') {
          const question = slide.content as Question;
          const questionId = question.id;
          const videoId = slide.videoId;
          // Use composite key: videoId_questionId
          const compositeKey = `${videoId}_${questionId}`;
          const saved = savedResponses[compositeKey];
          if (saved) {
            // For SJT questions, reconstruct the full response object from metadata
            // because we only save intentScore as the answer value
            const isSJT = question.type === 'behavioral-intent' &&
                          saved.metadata?.selectedOptionId;
            if (isSJT && saved.metadata) {
              preFilledResponses[compositeKey] = {
                selectedOptionId: saved.metadata.selectedOptionId!,
                intentScore: saved.answer as number
              };
            } else {
              preFilledResponses[compositeKey] = saved.answer;
            }
          }
        }
      });
      // Only update if we have new pre-filled responses
      if (Object.keys(preFilledResponses).length > 0) {
        setResponses((prev) => ({ ...prev, ...preFilledResponses }));
      }
    }
  }, [slides, savedResponses]);

  const handleVideoProgress = (videoId: string, watchedDuration: number, totalDuration: number) => {
    if (!campaign || !user || !totalDuration) return;
    updateVideoProgress(
      campaign.id,
      user.id,
      videoId,
      user.organization || '',
      watchedDuration,
      totalDuration
    ).catch(err => console.error('Failed to track video progress', err));
  };

  const handleVideoCompleted = async (
    itemId: string,
    videoId: string,
    questionTarget: number,
    watchedDuration?: number,
    totalDuration?: number
  ) => {
    if (!campaign || !user) return;
    console.log(`🎬 handleVideoCompleted called:`, { itemId, videoId, questionTarget, watchedDuration, totalDuration });
    try {
      if (watchedDuration !== undefined && totalDuration !== undefined) {
        handleVideoProgress(videoId, watchedDuration, totalDuration);
      }

      await setModuleVideoFinished(campaign.id, user.id, itemId, {
        questionTarget,
        watchedDuration,
        totalDuration,
      });
      console.log(`✅ setModuleVideoFinished completed for ${itemId}`);
    } catch (error) {
      console.error('Failed to record video completion', error);
    }
  };

  const handleAnswer = async (questionId: string, videoId: string, answer: ResponseValue) => {
    const compositeKey = `${videoId}_${questionId}`;
    console.log(`📝 handleAnswer called:`, { questionId, videoId, compositeKey, answer });
    setResponses(prev => ({ ...prev, [compositeKey]: answer }));
    const currentSlide = slides[currentSlideIndex];

    if (!campaign || !user || !currentSlide) return;

    console.log(`📝 Current slide info:`, { 
      itemId: currentSlide.itemId, 
      questionTarget: currentSlide.questionTarget,
      videoId: currentSlide.videoId 
    });

    setSavingResponse(compositeKey);
    try {
      const question = currentSlide.content as Question;

      // Handle SJT response (Q2 with options)
      const isSJTResponse = typeof answer === 'object' && 'selectedOptionId' in answer;

      await saveCampaignResponse(
        campaign.id,
        currentSlide.videoId,
        questionId,
        user.id,
        user.organization || '',
        isSJTResponse ? (answer as { selectedOptionId: string; intentScore: number }).intentScore : answer,
        {
          questionType: question.type,
          questionText: question.statement,
          competencyId: question.competencyId,
          skillId: question.skillId,
          // Include SJT-specific fields for Q2
          ...(isSJTResponse && {
            selectedOptionId: (answer as { selectedOptionId: string; intentScore: number }).selectedOptionId,
            intentScore: (answer as { selectedOptionId: string; intentScore: number }).intentScore
          })
        }
      );

      // Auto-scroll to next after delay
      setTimeout(() => {
        scrollToSlide(currentSlideIndex + 1);
      }, 800);

      await incrementModuleQuestionProgress(
        campaign.id,
        user.id,
        currentSlide.itemId,
        currentSlide.questionTarget,
        1,
        questionId
      );

    } catch (error) {
      console.error("Failed to save response", error);
    } finally {
      setSavingResponse(null);
    }
  };

  const scrollToSlide = (index: number) => {
    if (index >= slides.length) {
      // End of campaign - go to campaign details to show completion summary
      navigate(`/employee/campaign/${moduleId}`);
      return;
    }
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: index * containerRef.current.clientHeight,
        behavior: 'smooth'
      });
    }
  };

  // Loading state - skeleton that matches the video experience
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black text-white overflow-hidden">
        {/* Close button skeleton */}
        <div className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full bg-white/10 animate-pulse" />

        {/* Video player skeleton */}
        <div className="h-full w-full flex flex-col items-center justify-center px-6">
          {/* Video area */}
          <div className="w-full max-w-md aspect-[9/16] bg-white/5 rounded-2xl animate-pulse mb-6" />

          {/* Title skeleton */}
          <div className="w-3/4 h-6 bg-white/10 rounded-lg animate-pulse mb-3" />
          <div className="w-1/2 h-4 bg-white/10 rounded animate-pulse" />
        </div>

        {/* Bottom hint skeleton */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-8 h-8 bg-white/10 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (loadError || slides.length === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <p>{loadError || "No content available"}</p>
        <button onClick={() => navigate('/employee/home')} className="mt-4 underline">Back</button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      {/* Close Button */}
      <button
        onClick={() => navigate(`/employee/campaign/${moduleId}`)}
        className="absolute top-6 right-6 z-50 bg-black/20 backdrop-blur-sm p-2 rounded-full text-white hover:bg-white/20 transition-all"
      >
        <X size={24} />
      </button>

      {/* Main Feed Container */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {slides.map((slide, index) => {
          const isActive = index === currentSlideIndex;

          return (
            <div
              key={slide.id}
              className="h-full w-full snap-start snap-always relative flex items-center justify-center"
            >
              {slide.type === 'video' ? (
                <VideoSlide
                  data={slide.content as VideoWithData}
                  isActive={isActive}
                  onCompleted={(metrics) =>
                    handleVideoCompleted(
                      slide.itemId,
                      slide.videoId,
                      slide.questionTarget,
                      metrics?.watchedDuration,
                      metrics?.totalDuration
                    )
                  }
                  onProgress={(watched, total) =>
                    handleVideoProgress(slide.videoId, watched, total)
                  }
                />
              ) : (
                <QuestionSlide
                  data={slide.content as Question}
                  response={responses[`${slide.videoId}_${(slide.content as Question).id}`]}
                  onAnswer={(val) => handleAnswer((slide.content as Question).id, slide.videoId, val)}
                  isSaving={savingResponse === `${slide.videoId}_${(slide.content as Question).id}`}
                  questionIndex={slides.filter((s, i) => i <= index && s.type === 'question').length - 1}
                  totalQuestions={slides.filter(s => s.type === 'question').length}
                />
              )}

              {/* Navigation Hints */}
              {isActive && index < slides.length - 1 && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/50 pointer-events-none">
                  <ChevronUp size={32} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Sub-components for cleaner rendering

const VideoSlide = ({
  data,
  isActive,
  onCompleted,
  onProgress
}: {
  data: VideoWithData;
  isActive: boolean;
  onCompleted?: (metrics: { watchedDuration?: number; totalDuration?: number }) => void;
  onProgress?: (watchedDuration: number, totalDuration: number) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasReportedRef = useRef(false);
  const maxWatchTimeRef = useRef(0);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        hasReportedRef.current = false;
        maxWatchTimeRef.current = 0;
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(e => console.log("Autoplay prevented", e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isActive]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime || 0;
    maxWatchTimeRef.current = Math.max(maxWatchTimeRef.current, current);
  };

  const handleEnded = () => {
    if (hasReportedRef.current) return;
    hasReportedRef.current = true;
    const totalDuration = videoRef.current?.duration || data.duration || 0;
    const watchedDuration = Math.max(
      maxWatchTimeRef.current,
      videoRef.current?.currentTime || 0
    );

    if (totalDuration > 0 && onProgress) {
      onProgress(watchedDuration, totalDuration);
    }

    onCompleted?.({ watchedDuration, totalDuration });
  };

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        src={data.videoUrl}
        className="w-full h-full object-cover"
        playsInline
        muted={false} // User interaction required usually, or muted autoplay
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-6 pb-20 pointer-events-none">
        <h2 className="text-2xl font-bold mb-2">{data.title}</h2>
        {data.description && <p className="text-white/80 line-clamp-2">{data.description}</p>}
      </div>
    </div>
  );
};

// Response type for Q2 SJT questions
interface SJTResponse {
  selectedOptionId: string;
  intentScore: number;
}

const QuestionSlide = ({
  data,
  response,
  onAnswer,
  isSaving,
  questionIndex,
  totalQuestions
}: {
  data: Question;
  response: string | number | boolean | SJTResponse | undefined;
  onAnswer: (val: string | number | boolean | SJTResponse) => void;
  isSaving: boolean;
  questionIndex?: number;
  totalQuestions?: number;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textValue, setTextValue] = useState(
    typeof response === 'string' ? response : ''
  );

  // Determine if answered based on response type
  const isAnswered = response !== undefined;

  // For Q2 SJT, check if response has selectedOptionId
  const selectedOptionId = typeof response === 'object' && response !== null && 'selectedOptionId' in response
    ? (response as SJTResponse).selectedOptionId
    : undefined;

  // Sync textValue when response prop changes (e.g., loaded from Firestore)
  useEffect(() => {
    if (typeof response === 'string') {
      setTextValue(response);
    }
  }, [response]);

  // Progress percentage for the bar
  const progressPercent = questionIndex !== undefined && totalQuestions 
    ? ((questionIndex + 1) / totalQuestions) * 100 
    : 0;

  return (
    <div className="w-full h-full bg-gradient-to-b from-[#0f1419] to-[#1a1a1a] flex items-center justify-center p-5 relative overflow-y-auto">
      {/* Progress bar */}
      {questionIndex !== undefined && totalQuestions !== undefined && (
        <div className="absolute top-10 left-6 right-20 h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-[#00A3FF] to-[#00D4FF] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
            </div>
          )}

      <div className="w-full max-w-sm mx-auto">
        {/* Question Counter */}
        {questionIndex !== undefined && totalQuestions !== undefined && (
          <motion.div 
            className="mb-5"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="text-[#00A3FF] text-base font-semibold">Question {questionIndex + 1}</span>
            <span className="text-white/30 text-base">/{totalQuestions}</span>
          </motion.div>
        )}

        {/* Context Card */}
        <motion.div 
          className="bg-gradient-to-br from-white/8 to-white/4 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-start gap-3">
            <span className="text-[#00A3FF] text-4xl font-bold flex-shrink-0 leading-none">*</span>
            <p className="text-sm leading-relaxed flex-1 pt-1">
              {(() => {
                const text = data.statement || '';
                const words = text.split(' ');
                const midWordIndex = Math.ceil(words.length / 2);
                const firstHalf = words.slice(0, midWordIndex).join(' ');
                const secondHalf = words.slice(midWordIndex).join(' ');
                return (
                  <>
                    <span className="text-white/40">{firstHalf} </span>
                    <span className="text-white">{secondHalf}</span>
                  </>
                );
              })()}
            </p>
        </div>
        </motion.div>

        {/* Question Prompt */}
        {data.type === 'behavioral-intent' && data.options && data.options.length > 0 && (
          <motion.h3 
            className="text-white font-semibold text-lg mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            What would you do?
          </motion.h3>
        )}

        <div className={`${isAnswered ? 'pointer-events-none' : ''}`}>
          {/* Q1 - Behavioral Perception (7-point Likert scale) */}
          {data.type === 'behavioral-perception' && (
            <motion.div 
              className="space-y-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex justify-between text-xs text-white/40 px-1">
                <span>{data.scaleLabels?.low || 'Strongly Disagree'}</span>
                <span>{data.scaleLabels?.high || 'Strongly Agree'}</span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((val) => (
                  <motion.button
                    key={val}
                    onClick={() => !isAnswered && onAnswer(val)}
                    disabled={isAnswered}
                    whileTap={{ scale: 0.95 }}
                    className={`
                      aspect-square rounded-2xl font-bold text-base transition-all duration-200
                      ${response === val
                        ? 'bg-gradient-to-br from-[#00A3FF] to-[#0077B3] text-white shadow-xl shadow-[#00A3FF]/30 scale-110'
                        : isAnswered
                          ? 'bg-white/5 text-white/20'
                          : 'bg-white/10 hover:bg-white/15 text-white/70 hover:text-white active:scale-95'}
                    `}
                  >
                    {val}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Q2 - Behavioral Intent (SJT Multiple Choice) - Tall 2x2 Grid */}
          {data.type === 'behavioral-intent' && data.options && data.options.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {data.options.map((option, idx) => {
                const isSelected = selectedOptionId === option.id;
                
                return (
                  <motion.button
                  key={option.id}
                  onClick={() => !isAnswered && onAnswer({
                    selectedOptionId: option.id,
                    intentScore: option.intentScore
                  })}
                  disabled={isAnswered}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.05 }}
                    whileTap={{ scale: 0.98 }}
                  className={`
                      relative rounded-3xl p-4 transition-all duration-200 min-h-[160px] flex flex-col
                      ${isSelected
                        ? isAnswered
                          ? 'bg-gradient-to-br from-[#00A3FF]/30 to-[#0077B3]/20 ring-1 ring-[#00A3FF]/50'
                          : 'bg-gradient-to-br from-[#00A3FF] to-[#0077B3] ring-2 ring-[#00A3FF] shadow-xl shadow-[#00A3FF]/30'
                      : isAnswered
                          ? 'bg-white/5'
                          : 'bg-gradient-to-br from-white/10 to-white/5 hover:from-white/15 hover:to-white/8 active:scale-[0.98]'}
                    `}
                  >
                    {/* Selection indicator - show check when answered */}
                    {isSelected && isAnswered && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-3 left-3 w-6 h-6 rounded-full flex items-center justify-center shadow-lg bg-[#00A3FF]/70"
                      >
                        <Check size={14} className="text-white" strokeWidth={3} />
                      </motion.div>
                    )}
                    
                    {/* Option content */}
                    <div className="flex flex-col items-center justify-center flex-1 text-center px-2">
                      {/* Option text */}
                      <span className={`text-[11px] leading-snug transition-all ${
                        isSelected
                          ? isAnswered
                            ? 'text-white/80 font-medium'
                            : 'text-white font-medium'
                          : isAnswered
                            ? 'text-white/30'
                            : 'text-white/70'
                      }`}>
                        {option.text}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Fallback for Q2 without options (legacy support) */}
          {data.type === 'behavioral-intent' && (!data.options || data.options.length === 0) && (
            <motion.div 
              className="space-y-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-white font-semibold text-lg">
                How likely would you do this?
              </h3>
              <div className="flex justify-between text-xs text-white/40 px-1">
                <span>{data.scaleLabels?.low || 'Unlikely'}</span>
                <span>{data.scaleLabels?.high || 'Very Likely'}</span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((val) => (
                  <motion.button
                    key={val}
                    onClick={() => !isAnswered && onAnswer(val)}
                    disabled={isAnswered}
                    whileTap={{ scale: 0.95 }}
                    className={`
                      aspect-square rounded-2xl font-bold text-base transition-all duration-200
                      ${response === val
                        ? 'bg-gradient-to-br from-[#00A3FF] to-[#0077B3] text-white shadow-xl shadow-[#00A3FF]/30 scale-110'
                        : isAnswered
                          ? 'bg-white/5 text-white/20'
                          : 'bg-white/10 hover:bg-white/15 text-white/70 hover:text-white active:scale-95'}
                    `}
                  >
                    {val}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Q3 - Qualitative (Free text) */}
          {data.type === 'qualitative' && (
            <motion.div 
              className="space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-white font-semibold text-lg">
                Share your thoughts
              </h3>
              <textarea
                ref={textareaRef}
                value={textValue}
                onChange={(e) => !isAnswered && setTextValue(e.target.value)}
                disabled={isAnswered}
                className={`w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/30 min-h-[140px] focus:outline-none transition-all resize-none ${isAnswered
                  ? 'opacity-50'
                  : 'focus:border-[#00A3FF]/50 focus:ring-2 focus:ring-[#00A3FF]/20'
                  }`}
                placeholder={isAnswered ? "Your answer has been saved" : "Type your response here..."}
                onBlur={(e) => !isAnswered && e.target.value && onAnswer(e.target.value)}
              />
              {!isAnswered && textValue && (
                <motion.button
                  onClick={() => textareaRef.current?.blur()}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 bg-gradient-to-r from-[#00A3FF] to-[#0077B3] rounded-2xl font-semibold text-sm text-white shadow-lg shadow-[#00A3FF]/20 hover:shadow-xl hover:shadow-[#00A3FF]/30 transition-all"
                >
                  Submit
                </motion.button>
              )}
            </motion.div>
          )}
        </div>

        {/* Saving indicator */}
        {isSaving && (
          <motion.div 
            className="mt-6 flex justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/60 text-sm">
              <Loader className="animate-spin" size={16} />
              <span>Saving...</span>
            </div>
          </motion.div>
        )}

        {/* Answered indicator */}
        {isAnswered && !isSaving && (
          <motion.div 
            className="mt-6 flex justify-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/30 text-green-400 text-sm font-medium shadow-lg shadow-green-500/10">
              <Check size={16} strokeWidth={3} />
              <span>Answer saved</span>
            </div>
          </motion.div>
        )}

        {/* Swipe hint */}
        {isAnswered && !isSaving && (
          <motion.div 
            className="mt-4 flex justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex flex-col items-center text-white/30 text-xs">
              <ChevronUp size={20} className="animate-bounce" />
              <span>Swipe up for next</span>
          </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default VideoModule;
