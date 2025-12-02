import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Check,
  Lock,
  Clock,
  BookOpen,
  BarChart3
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCampaign,
  updateEnrollmentAccess,
  getVideo
} from '@/lib/firestore';
import { useEnrollmentRealtime } from '@/hooks/useEnrollmentRealtime';
import type { Campaign, Video } from '@/types';

const CampaignDetails: React.FC = () => {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoMap, setVideoMap] = useState<Record<string, Video>>({});

  // Real-time enrollment hook
  const { enrollment, isLoading: isLoadingEnrollment } = useEnrollmentRealtime(
    campaignId || '',
    user?.id || ''
  );

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

  const handleStart = () => {
    if (!campaign) return;
    navigate(`/employee/module/${campaign.id}`);
  };

  if (isLoading || isLoadingEnrollment) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-white/70">Loading...</div>
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

  const totalVideos = campaign.items.length;
  const minutesPerModule = 5;
  const moduleProgressMap = enrollment?.moduleProgress || {};
  const completedModules =
    enrollment?.completedModules ?? Object.values(moduleProgressMap).filter((m) => m.completed).length;
  const progressPercentage =
    totalVideos === 0 ? 0 : Math.round((completedModules / totalVideos) * 100);
  const progress = Number.isNaN(progressPercentage) ? 0 : progressPercentage;
  const hasStarted =
    Object.keys(moduleProgressMap).length > 0 ||
    enrollment?.status === 'in-progress' ||
    enrollment?.status === 'completed';
  const isComplete = totalVideos > 0 && completedModules >= totalVideos;
  const firstIncompleteIndex = campaign.items.findIndex(
    (item) => !moduleProgressMap[item.id]?.completed
  );
  const totalEstimatedMinutes = campaign.items.reduce((total, item) => {
    const video = videoMap[item.videoId];
    const questionCount = video?.questions ? video.questions.length : 3;
    const videoMinutes = video?.duration ? Math.ceil(video.duration / 60) : minutesPerModule;
    return total + videoMinutes + questionCount;
  }, 0);

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <div className="p-4 sm:p-8 space-y-6">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#0b1324] via-[#152b55] to-[#1d4ed8] text-white shadow-2xl">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.7),_transparent_60%)] pointer-events-none" />
          <div className="relative p-6 sm:p-8 space-y-8">
            <button
              onClick={() => navigate('/employee/home')}
              className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm border border-white/20">
                <ArrowLeft size={18} />
              </span>
              Back to campaigns
            </button>

            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/60 mb-2">Campaign</p>
                <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
                  {campaign.title}
                </h1>
              </div>
              <div className="w-full max-w-md space-y-3">
                <div className="flex items-baseline justify-between text-white gap-4">
                  <p className="text-sm text-white/70">
                    {isComplete ? 'Completed' : hasStarted ? 'In progress' : 'Not started'}
                  </p>
                  {hasStarted && <span className="text-3xl font-semibold">{progress}%</span>}
                </div>
                {hasStarted ? (
                  <div className="mt-1 h-2 rounded-full bg-white/20 overflow-hidden w-full">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={handleStart}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/30 px-6 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                  >
                    <Play size={16} fill="currentColor" />
                    Start campaign
                  </button>
                )}
                <div className="flex flex-wrap gap-2">
                  {status !== 'completed' && (
                    <button
                      onClick={handleStart}
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                    >
                      <Play size={16} fill="currentColor" />
                      {hasStarted ? 'Continue' : 'Start campaign'}
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/employee/comparison/${campaign.id}`)}
                    className="inline-flex items-center gap-2 rounded-full bg-white text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-white/90 transition-colors"
                  >
                    <BarChart3 size={16} />
                    View comparison
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-white/80">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.3em]">
                <BookOpen size={16} />
                <span className="text-white">{totalVideos} modules</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.3em]">
                <Clock size={16} />
                <span className="text-white">{totalEstimatedMinutes} mins</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module List */}
      <div className="flex-1 px-4 sm:px-8 pb-24 space-y-1 mt-4">
        {campaign.items.map((item, index) => {
          const chapterNum = index + 1;
          const videoMeta = videoMap[item.videoId];
          const moduleTitle = videoMeta?.title || `Module ${chapterNum}`;
          const moduleDescription = videoMeta?.description || 'Video Lesson';
          const questionCount = videoMeta?.questions ? videoMeta.questions.length : 3;
          const moduleDurationMinutes = videoMeta?.duration
            ? Math.ceil(videoMeta.duration / 60) + questionCount
            : minutesPerModule + questionCount;
          const moduleDuration = `${moduleDurationMinutes} mins`;
          const thumbnailUrl = videoMeta?.thumbnailUrl;
          const moduleState = moduleProgressMap[item.id];
          const completed = !!moduleState?.completed;
          // If module is completed, show 100%. Otherwise calculate progress.
          const moduleProgressPercent = completed
            ? 100
            : moduleState
              ? Math.round(
                ((moduleState.videoFinished ? 1 : 0) +
                  Math.min(moduleState.questionsAnswered, moduleState.questionTarget)) /
                (moduleState.questionTarget + 1) *
                100
              )
              : 0;
          const isCurrent = !completed && firstIncompleteIndex === index && !isComplete;
          const isLocked = !completed && firstIncompleteIndex !== -1 && index > firstIncompleteIndex;

          if (isCurrent) {
            if (!hasStarted) {
              return (
                <div
                  key={item.id}
                  onClick={handleStart}
                  className="bg-white/10 border border-white/20 rounded-[2rem] p-6 sm:p-7 text-white cursor-pointer hover:bg-white/15 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {thumbnailUrl && (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-white/10 flex-shrink-0">
                        <img src={thumbnailUrl} alt={moduleTitle} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-2xl font-semibold">{moduleTitle}</h3>
                      <p className="text-sm text-white/70">
                        {moduleDescription} • {moduleDuration}
                      </p>
                    </div>
                  </div>
                  <button className="mt-6 w-full py-3.5 bg-white text-slate-900 rounded-2xl font-semibold flex items-center justify-center gap-2">
                    <Play size={18} fill="currentColor" className="text-slate-900" />
                    Start learning
                  </button>
                </div>
              );
            }
            return (
              <div
                key={item.id}
                onClick={handleStart}
                className="bg-transparent pb-6 mb-4 cursor-pointer"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    {thumbnailUrl && (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0">
                        <img src={thumbnailUrl} alt={moduleTitle} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                        In Progress
                      </p>
                      <h3 className="text-xl font-semibold text-white mt-1">{moduleTitle}</h3>
                      {moduleProgressPercent > 0 && (
                        <div className="mt-3">
                          <div className="h-2 bg-slate-900/40 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500"
                              style={{ width: `${moduleProgressPercent}%` }}
                            />
                          </div>
                          <div className="mt-1 flex justify-between text-xs text-white/70">
                            <span>Module progress</span>
                            <span>{moduleProgressPercent}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button className="mt-6 w-full py-3.5 bg-blue-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-500 transition-colors">
                  <Play size={18} fill="currentColor" />
                  Continue learning
                </button>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              onClick={() => !isLocked && handleStart()}
              className={`py-4 flex items-center justify-between gap-4 rounded-2xl px-3 ${index % 2 === 0 ? 'bg-white/5' : 'bg-transparent'
                } ${completed ? 'text-white' : 'text-white/60'} ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
            >
              <div className="flex items-center gap-4">
                {thumbnailUrl && (
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/10 flex-shrink-0">
                    <img src={thumbnailUrl} alt={moduleTitle} className="w-full h-full object-cover" />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {moduleTitle}
                  </h3>
                  <p className="text-sm text-white/40">
                    {moduleDescription} • {moduleDuration}
                  </p>
                </div>
                {!completed && moduleProgressPercent > 0 && (
                  <div className="mt-2 w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/60 rounded-full"
                      style={{ width: `${moduleProgressPercent}%` }}
                    />
                  </div>
                )}
              </div>
              <div
                className={`${completed ? 'w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white' : 'flex items-center justify-center'}`}
              >
                {completed ? <Check size={18} /> : <Lock size={18} className="text-white/40" />}
              </div>
            </div>
          );
        })}
        <div className="h-8" />
      </div>
    </div>
  );
};

export default CampaignDetails;
