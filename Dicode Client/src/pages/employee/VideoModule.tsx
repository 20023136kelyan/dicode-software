import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

  // Current state
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string | number | boolean>>({});
  const [savingResponse, setSavingResponse] = useState<string | null>(null); // questionId being saved

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
        // Check and ensure enrollment
        const existingEnrollment = await checkUserEnrollment(moduleId, user.id);
        if (!existingEnrollment) {
          await enrollUserInCampaign(moduleId, user.id, user.organization || '', 'system', true);
        }

        // Update enrollment access
        await updateEnrollmentAccess(moduleId, user.id);

        // Load campaign
        const campaignData = await getCampaign(moduleId);
        if (!isMounted) return;

        if (!campaignData) {
          setLoadError('Campaign not found');
          setIsLoading(false);
          return;
        }

        setCampaign(campaignData);

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

        videosData.forEach((video) => {
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

          // Add Question Slides
          video.questions.forEach((question) => {
            generatedSlides.push({
              id: `q-${question.id}`,
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

        setSlides(generatedSlides);
        setIsLoading(false);

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
  useEffect(() => {
    if (slides.length > 0 && Object.keys(savedResponses).length > 0) {
      // Pre-fill responses from Firestore
      const preFilledResponses: Record<string, string | number | boolean> = {};
      slides.forEach((slide) => {
        if (slide.type === 'question') {
          const questionId = (slide.content as Question).id;
          const savedResponse = savedResponses[questionId];
          if (savedResponse) {
            preFilledResponses[questionId] = savedResponse.answer;
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
    try {
      if (watchedDuration !== undefined && totalDuration !== undefined) {
        handleVideoProgress(videoId, watchedDuration, totalDuration);
      }

      await setModuleVideoFinished(campaign.id, user.id, itemId, {
        questionTarget,
        watchedDuration,
        totalDuration,
      });
    } catch (error) {
      console.error('Failed to record video completion', error);
    }
  };

  const handleAnswer = async (questionId: string, answer: string | number | boolean) => {
    setResponses(prev => ({ ...prev, [questionId]: answer }));
    const currentSlide = slides[currentSlideIndex];

    if (!campaign || !user || !currentSlide) return;

    setSavingResponse(questionId);
    try {
      const question = currentSlide.content as Question;
      await saveCampaignResponse(
        campaign.id,
        currentSlide.videoId,
        questionId,
        user.id,
        user.organization || '',
        answer,
        {
          questionType: question.type,
          questionText: question.statement
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
      // End of campaign
      navigate(`/employee/comparison/${moduleId}`);
      return;
    }
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: index * containerRef.current.clientHeight,
        behavior: 'smooth'
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <Loader className="w-12 h-12 animate-spin text-white mb-4" />
        <p className="text-white/70">Loading experience...</p>
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
                  response={responses[(slide.content as Question).id]}
                  onAnswer={(val) => handleAnswer((slide.content as Question).id, val)}
                  isSaving={savingResponse === (slide.content as Question).id}
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

const QuestionSlide = ({
  data,
  response,
  onAnswer,
  isSaving
}: {
  data: Question;
  response: string | number | boolean | undefined;
  onAnswer: (val: string | number | boolean) => void;
  isSaving: boolean;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textValue, setTextValue] = useState(
    typeof response === 'string' ? response : ''
  );

  const isAnswered = response !== undefined;

  // Sync textValue when response prop changes (e.g., loaded from Firestore)
  useEffect(() => {
    if (typeof response === 'string') {
      setTextValue(response);
    }
  }, [response]);

  return (
    <div className="w-full h-full bg-dark-bg flex flex-col items-center justify-center p-8 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-blue-900/20 to-transparent" />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="flex items-center justify-center gap-3 mb-8">
          <h3 className="text-2xl font-bold text-center text-white leading-snug">
            {data.statement}
          </h3>
          {isAnswered && (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <Check size={20} className="text-white" strokeWidth={3} />
            </div>
          )}
        </div>

        <div className={`space-y-3 ${isAnswered ? 'opacity-50 pointer-events-none' : ''}`}>
          {(data.type === 'behavioral-perception' || data.type === 'behavioral-intent') && (
            <>
              <div className="flex justify-between text-sm text-white/50 mb-2 px-2">
                <span>{data.scaleLabels?.low || 'Disagree'}</span>
                <span>{data.scaleLabels?.high || 'Agree'}</span>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    onClick={() => !isAnswered && onAnswer(val)}
                    disabled={isAnswered}
                    className={`
                                            aspect-square rounded-xl font-bold text-lg transition-all
                                            ${response === val
                        ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/50'
                        : isAnswered
                          ? 'bg-white/5 text-white/20 cursor-not-allowed'
                          : 'bg-white/10 hover:bg-white/20 text-white cursor-pointer'}
                                        `}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </>
          )}

          {data.type === 'qualitative' && (
            <div className="space-y-4">
              <textarea
                ref={textareaRef}
                value={textValue}
                onChange={(e) => !isAnswered && setTextValue(e.target.value)}
                disabled={isAnswered}
                className={`w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/30 min-h-[150px] focus:outline-none transition-colors ${isAnswered
                  ? 'cursor-not-allowed opacity-60'
                  : 'focus:border-primary/50'
                  }`}
                placeholder={isAnswered ? "Your answer has been saved" : "Type your thoughts here..."}
                onBlur={(e) => !isAnswered && e.target.value && onAnswer(e.target.value)}
              />
              {!isAnswered && (
                <button
                  onClick={() => textareaRef.current?.blur()}
                  className="w-full py-3 bg-primary rounded-xl font-semibold text-white hover:bg-blue-600 transition-colors"
                >
                  Submit Answer
                </button>
              )}
            </div>
          )}
        </div>

        {isSaving && (
          <div className="mt-6 flex justify-center">
            <Loader className="animate-spin text-white/50" size={20} />
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoModule;
