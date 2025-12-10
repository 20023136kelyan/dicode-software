'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  X,
  CheckCircle2,
  UploadCloud,
  Film,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Plus,
  Globe,
  Building,
} from 'lucide-react';
import type { QuestionFormData, Campaign, Organization } from '@/lib/types';
import QuestionBuilder from '@/components/Questions/QuestionBuilder';
import { validateQuestionSet } from '@/lib/questionValidation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { getCampaignsByUser, getAllCampaigns, createVideo, createCampaignItem, getCampaign, logActivity, getAllOrganizations } from '@/lib/firestore';
import { uploadVideo, uploadVideoBlob, generateVideoPath } from '@/lib/storage';
import { extractThumbnail, getVideoDuration } from '@/lib/videoUtils';
import { buildTagList } from '@/lib/competencies';
import { useCompetencies } from '@/hooks/useCompetencies';
import { createDefaultQuestionSet } from '@/lib/questionDefaults';
import { generateQuestion, validateQuestion, type GenerateQuestionResponse, type ValidateQuestionResponse } from '@/lib/questionTools';
import type { QuestionAssistantState } from '@/types/questionAssist';
import { convertFormDataToQuestions } from '@/lib/questionUtils';
import { VideoThumbnail } from '@/components/VideoThumbnail';

export interface UploadVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (videoId: string) => void;
}

type UploadStage =
  | 'idle'
  | 'extracting_metadata'
  | 'uploading_video'
  | 'uploading_thumbnail'
  | 'saving_metadata'
  | 'adding_to_campaign'
  | 'complete'
  | 'error';

interface VideoUploadProgress {
  stage: UploadStage;
  progress: number;
  message: string;
}

interface VideoConfig {
  file: File;
  previewUrl: string;
  duration: number | null;
  title: string;
  description: string;
  questions: QuestionFormData[];
  campaignId: string;
  allowedOrganizations: string[]; // Empty = Global
  isValid: boolean;
}

type ModalStep = 'select' | 'configure' | 'review' | 'uploading';

export function UploadVideoModal({
  isOpen,
  onClose,
  onSuccess,
}: UploadVideoModalProps) {
  const { user } = useAuth();
  const { competencies } = useCompetencies();

  // Multi-video state
  const [videoConfigs, setVideoConfigs] = useState<VideoConfig[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [modalStep, setModalStep] = useState<ModalStep>('select');

  // Campaign & Org state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Upload state
  const [uploadProgress, setUploadProgress] = useState<VideoUploadProgress[]>([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedVideoIds, setUploadedVideoIds] = useState<string[]>([]);

  // Validation state
  const [titleError, setTitleError] = useState('');

  // Question assistant state
  const [questionAssistants, setQuestionAssistants] = useState<Record<number, QuestionAssistantState>>({});

  // Current video being configured
  const currentVideo = videoConfigs[currentVideoIndex];

  // Load campaigns (dicode source for DiCode staff, user's own for others)
  useEffect(() => {
    if (isOpen && user) {
      setLoadingCampaigns(true);
      const isDiCodeStaff = user.email?.endsWith('@di-code.de');
      const fetchCampaigns = isDiCodeStaff ? getAllCampaigns() : getCampaignsByUser(user.uid);
      fetchCampaigns
        .then((fetchedCampaigns) => {
          // DiCode staff only see 'dicode' source campaigns (or no source = legacy dicode)
          const filtered = isDiCodeStaff
            ? fetchedCampaigns.filter(c => c.source === 'dicode' || !c.source)
            : fetchedCampaigns;
          setCampaigns(filtered);
        })
        .catch((error) => {
          console.error('Failed to load campaigns:', error);
        })
        .finally(() => {
          setLoadingCampaigns(false);
        });
    }
  }, [isOpen, user]);

  // Load organizations
  useEffect(() => {
    if (isOpen) {
      getAllOrganizations()
        .then(setOrganizations)
        .catch(err => console.error('Failed to load organizations:', err));
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Clean up preview URLs before resetting
      // Use functional update to get current videoConfigs
      setVideoConfigs(prev => {
        prev.forEach(config => {
          if (config.previewUrl) {
            URL.revokeObjectURL(config.previewUrl);
          }
        });
        return [];
      });
      setCurrentVideoIndex(0);
      setModalStep('select');
      setUploadProgress([]);
      setCurrentUploadIndex(0);
      setSaving(false);
      setError(null);
      setTitleError('');
      setQuestionAssistants({});
      setUploadedVideoIds([]);
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, saving, onClose]);

  // Dropzone configuration - now accepts multiple files
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'video/*': ['.mp4', '.mov', '.avi', '.webm', '.mkv'] },
    multiple: true,
    disabled: saving,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setError(null);

        // Process each file
        const newConfigs: VideoConfig[] = await Promise.all(
          acceptedFiles.map(async (file) => {
            const previewUrl = URL.createObjectURL(file);

            // Auto-fill title from filename
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
            const cleanTitle = nameWithoutExt.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();

            // Extract duration
            let duration: number | null = null;
            try {
              duration = await getVideoDuration(file);
            } catch (err) {
              console.warn('Failed to extract video duration:', err);
            }

            return {
              file,
              previewUrl,
              duration,
              title: cleanTitle,
              description: '',
              questions: createDefaultQuestionSet(),
              campaignId: '',
              allowedOrganizations: [],
              isValid: false,
            };
          })
        );

        setVideoConfigs(prev => [...prev, ...newConfigs]);
      }
    },
  });

  // Derive competency metadata from questions
  const deriveCompetencyMeta = useCallback((questionList: QuestionFormData[]) => {
    const competencyIds = new Set<string>();
    const skillsMap: Record<string, string[]> = {};

    questionList.forEach((question) => {
      if (!question.competencyId || !question.skillId) return;
      competencyIds.add(question.competencyId);
      if (!skillsMap[question.competencyId]) {
        skillsMap[question.competencyId] = [];
      }
      if (!skillsMap[question.competencyId].includes(question.skillId)) {
        skillsMap[question.competencyId].push(question.skillId);
      }
    });

    return {
      selectedCompetencies: Array.from(competencyIds),
      selectedSkills: skillsMap,
    };
  }, []);

  const questionSelections = useMemo(
    () => currentVideo ? deriveCompetencyMeta(currentVideo.questions) : { selectedCompetencies: [], selectedSkills: {} },
    [currentVideo, deriveCompetencyMeta]
  );

  const selectedTags = useMemo(
    () => buildTagList(questionSelections.selectedCompetencies, questionSelections.selectedSkills),
    [questionSelections]
  );

  // Question assistant handlers
  const clearQuestionAssistantState = useCallback((indices?: number[]) => {
    setQuestionAssistants((prev) => {
      if (!indices || indices.length === 0) {
        return {};
      }
      const next = { ...prev };
      indices.forEach((index) => {
        delete next[index];
      });
      return next;
    });
  }, []);

  const updateQuestionAssistantState = useCallback(
    (index: number, updates: Partial<QuestionAssistantState>) => {
      setQuestionAssistants((prev) => ({
        ...prev,
        [index]: { ...prev[index], ...updates },
      }));
    },
    []
  );

  const resolveQuestionContext = useCallback((question: QuestionFormData) => {
    if (!question.competencyId) {
      return {
        competencyName: undefined,
        skillName: question.competency?.trim() || undefined,
      };
    }
    const competency = competencies.find((entry) => entry.id === question.competencyId);
    const skill = competency?.skills.find((entry) => entry.id === question.skillId);
    return {
      competencyName: competency?.name,
      skillName: skill?.name || question.competency?.trim() || undefined,
    };
  }, [competencies]);

  const updateQuestionStatement = useCallback((index: number, statement: string) => {
    if (!currentVideo) return;
    setVideoConfigs(prev => {
      const next = [...prev];
      const questions = [...next[currentVideoIndex].questions];
      if (questions[index]) {
        questions[index] = { ...questions[index], statement };
      }
      next[currentVideoIndex] = { ...next[currentVideoIndex], questions };
      return next;
    });
  }, [currentVideo, currentVideoIndex]);

  const handleGenerateQuestion = useCallback(
    async (index: number) => {
      if (!currentVideo) return;
      const question = currentVideo.questions[index];
      if (!question) return;

      const state = questionAssistants[index];
      if (state?.isGenerating) return;

      updateQuestionAssistantState(index, {
        isGenerating: true,
        error: null,
        suggestedRewrite: null,
        issues: [],
        severity: undefined,
      });

      const { competencyName, skillName } = resolveQuestionContext(question);

      try {
        const result: GenerateQuestionResponse = await generateQuestion({
          role: question.role,
          competency: competencyName,
          skillName,
          videoTitle: currentVideo.title || undefined,
          scenarioDescription: currentVideo.description || undefined,
        });

        updateQuestionStatement(index, result.question.trim());
        updateQuestionAssistantState(index, {
          isGenerating: false,
          error: null,
          explanation: result.explanation,
          issues: [],
          severity: undefined,
          suggestedRewrite: null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate question';
        updateQuestionAssistantState(index, {
          isGenerating: false,
          error: message,
        });
      }
    },
    [currentVideo, questionAssistants, resolveQuestionContext, updateQuestionAssistantState, updateQuestionStatement]
  );

  const handleValidateQuestion = useCallback(
    async (index: number) => {
      if (!currentVideo) return;
      const question = currentVideo.questions[index];
      if (!question) return;

      if (!question.statement.trim()) {
        updateQuestionAssistantState(index, {
          error: 'Enter a question before validating.',
        });
        return;
      }

      const state = questionAssistants[index];
      if (state?.isValidating) return;

      const now = Date.now();
      if (state?.lastValidatedAt && now - state.lastValidatedAt < 1500) {
        return;
      }

      updateQuestionAssistantState(index, {
        isValidating: true,
        error: null,
      });

      const { competencyName, skillName } = resolveQuestionContext(question);

      try {
        const result: ValidateQuestionResponse = await validateQuestion({
          role: question.role,
          question: question.statement,
          competency: competencyName,
          skillName,
        });

        updateQuestionAssistantState(index, {
          isValidating: false,
          issues: result.issues,
          severity: result.severity,
          suggestedRewrite: result.suggestedRewrite,
          error: null,
          lastValidatedAt: Date.now(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to validate question';
        updateQuestionAssistantState(index, {
          isValidating: false,
          error: message,
        });
      }
    },
    [currentVideo, questionAssistants, resolveQuestionContext, updateQuestionAssistantState]
  );

  const handleApplySuggestion = useCallback(
    (index: number) => {
      const suggestion = questionAssistants[index]?.suggestedRewrite;
      if (!suggestion) return;
      updateQuestionStatement(index, suggestion.trim());
      clearQuestionAssistantState([index]);
    },
    [questionAssistants, updateQuestionStatement, clearQuestionAssistantState]
  );

  // Update current video config
  const updateCurrentVideo = useCallback((updates: Partial<VideoConfig>) => {
    setVideoConfigs(prev => {
      const next = [...prev];
      next[currentVideoIndex] = { ...next[currentVideoIndex], ...updates };
      return next;
    });
  }, [currentVideoIndex]);

  // Validate a single video config
  const validateVideoConfig = useCallback((config: VideoConfig): boolean => {
    if (!config.title.trim()) return false;
    if (config.title.trim().length > 200) return false;

    const questionErrors = validateQuestionSet(config.questions);
    if (questionErrors.length > 0) return false;

    // Check behavioral questions have competency/skill
    const missingMeta = config.questions.some(
      (q) =>
        (q.type === 'behavioral-perception' || q.type === 'behavioral-intent') &&
        (!q.competencyId || !q.skillId)
    );
    if (missingMeta) return false;

    return true;
  }, []);

  // Validate current video
  const validateCurrentVideo = useCallback(() => {
    setTitleError('');
    setError(null);

    if (!currentVideo) return false;

    if (!currentVideo.title.trim()) {
      setTitleError('Title is required');
      return false;
    }

    if (currentVideo.title.trim().length > 200) {
      setTitleError('Title must be 200 characters or less');
      return false;
    }

    const questionErrors = validateQuestionSet(currentVideo.questions);
    if (questionErrors.length > 0) {
      setError('Please complete all required question fields');
      return false;
    }

    // Check behavioral questions have competency/skill
    const missingMeta = currentVideo.questions.some(
      (q) =>
        (q.type === 'behavioral-perception' || q.type === 'behavioral-intent') &&
        (!q.competencyId || !q.skillId)
    );
    if (missingMeta) {
      setError('Please select competency and skill for all behavioral questions');
      return false;
    }

    // Mark as valid
    updateCurrentVideo({ isValid: true });
    return true;
  }, [currentVideo, updateCurrentVideo]);

  // Remove a video from the list
  const removeVideo = useCallback((index: number) => {
    setVideoConfigs(prev => {
      const config = prev[index];
      if (config?.previewUrl) {
        URL.revokeObjectURL(config.previewUrl);
      }
      const next = prev.filter((_, i) => i !== index);
      return next;
    });

    // Adjust current index if needed
    if (currentVideoIndex >= videoConfigs.length - 1 && currentVideoIndex > 0) {
      setCurrentVideoIndex(currentVideoIndex - 1);
    }
  }, [currentVideoIndex, videoConfigs.length]);

  // Navigation
  const goToNextVideo = useCallback(() => {
    if (validateCurrentVideo()) {
      if (currentVideoIndex < videoConfigs.length - 1) {
        setCurrentVideoIndex(currentVideoIndex + 1);
        setTitleError('');
        setError(null);
        setQuestionAssistants({});
      } else {
        // All videos configured, go to review
        setModalStep('review');
      }
    }
  }, [currentVideoIndex, videoConfigs.length, validateCurrentVideo]);

  const goToPrevVideo = useCallback(() => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(currentVideoIndex - 1);
      setTitleError('');
      setError(null);
      setQuestionAssistants({});
    }
  }, [currentVideoIndex]);

  const startConfiguring = useCallback(() => {
    if (videoConfigs.length > 0) {
      setCurrentVideoIndex(0);
      setModalStep('configure');
    }
  }, [videoConfigs.length]);

  const backToSelection = useCallback(() => {
    setModalStep('select');
    setCurrentVideoIndex(0);
    setTitleError('');
    setError(null);
    setQuestionAssistants({});
  }, []);

  const backToConfigure = useCallback(() => {
    setModalStep('configure');
    setCurrentVideoIndex(videoConfigs.length - 1);
    setTitleError('');
    setError(null);
    setQuestionAssistants({});
  }, [videoConfigs.length]);

  // Upload all videos
  const handleUploadAll = useCallback(async () => {
    if (!user || videoConfigs.length === 0) return;

    // Validate all videos first
    const allValid = videoConfigs.every(validateVideoConfig);
    if (!allValid) {
      setError('Some videos have validation errors. Please review and fix them.');
      return;
    }

    setSaving(true);
    setModalStep('uploading');
    setError(null);
    setUploadedVideoIds([]);

    // Initialize progress for all videos
    setUploadProgress(videoConfigs.map(() => ({
      stage: 'idle',
      progress: 0,
      message: 'Waiting...',
    })));

    const uploadedIds: string[] = [];

    for (let i = 0; i < videoConfigs.length; i++) {
      setCurrentUploadIndex(i);
      const config = videoConfigs[i];

      try {
        // Stage 1: Extract metadata
        setUploadProgress(prev => {
          const next = [...prev];
          next[i] = { stage: 'extracting_metadata', progress: 5, message: 'Extracting metadata...' };
          return next;
        });

        let thumbnailBlob: Blob | null = null;
        let duration = config.duration;

        try {
          thumbnailBlob = await extractThumbnail(config.file, 1);
          if (!duration) {
            duration = await getVideoDuration(config.file);
          }
        } catch (err) {
          console.warn('Failed to extract thumbnail:', err);
        }

        // Stage 2: Upload video
        setUploadProgress(prev => {
          const next = [...prev];
          next[i] = { stage: 'uploading_video', progress: 10, message: 'Uploading video...' };
          return next;
        });

        const videoPath = generateVideoPath(user.uid, config.file.name);
        const videoUrl = await uploadVideo(config.file, videoPath, (progress) => {
          setUploadProgress(prev => {
            const next = [...prev];
            next[i] = {
              stage: 'uploading_video',
              progress: 10 + progress * 0.6,
              message: `Uploading video... ${Math.round(progress)}%`,
            };
            return next;
          });
        });

        // Stage 3: Upload thumbnail
        let thumbnailUrl: string | undefined;
        if (thumbnailBlob) {
          setUploadProgress(prev => {
            const next = [...prev];
            next[i] = { stage: 'uploading_thumbnail', progress: 75, message: 'Uploading thumbnail...' };
            return next;
          });

          const thumbnailPath = videoPath.replace(/\.[^/.]+$/, '_thumb.jpg');
          thumbnailUrl = await uploadVideoBlob(thumbnailBlob, thumbnailPath, {
            contentType: 'image/jpeg',
          });
        }

        // Stage 4: Save to Firestore
        setUploadProgress(prev => {
          const next = [...prev];
          next[i] = { stage: 'saving_metadata', progress: 85, message: 'Saving metadata...' };
          return next;
        });

        // Build tags from competencies/skills
        const meta = deriveCompetencyMeta(config.questions);
        const tags = ['uploaded', ...buildTagList(meta.selectedCompetencies, meta.selectedSkills)];
        const convertedQuestions = convertFormDataToQuestions(config.questions);

        const videoId = await createVideo(user.uid, {
          title: config.title.trim(),
          description: config.description.trim() || undefined,
          storageUrl: videoUrl,
          thumbnailUrl,
          source: 'uploaded',
          duration: duration || undefined,
          questions: convertedQuestions,
          tags,
          allowedOrganizations: config.allowedOrganizations,
        });

        uploadedIds.push(videoId);

        // Stage 5: Add to campaign if selected
        if (config.campaignId) {
          setUploadProgress(prev => {
            const next = [...prev];
            next[i] = { stage: 'adding_to_campaign', progress: 92, message: 'Adding to campaign...' };
            return next;
          });

          const campaign = await getCampaign(config.campaignId);
          if (campaign) {
            const order = campaign.items.length;
            await createCampaignItem(config.campaignId, videoId, order);
          }
        }

        // Log activity
        await logActivity({
          action: 'video_uploaded',
          userId: user.uid,
          userEmail: user.email || '',
          userName: user.displayName || undefined,
          resourceId: videoId,
          resourceName: config.title.trim(),
          resourceType: 'video',
          metadata: {
            duration,
            hasThumbnail: !!thumbnailUrl,
            hasQuestions: config.questions.length > 0,
            campaignId: config.campaignId || undefined,
          },
        });

        // Complete
        setUploadProgress(prev => {
          const next = [...prev];
          next[i] = { stage: 'complete', progress: 100, message: 'Uploaded successfully!' };
          return next;
        });

      } catch (err) {
        console.error(`Upload failed for video ${i + 1}:`, err);
        setUploadProgress(prev => {
          const next = [...prev];
          next[i] = {
            stage: 'error',
            progress: 0,
            message: err instanceof Error ? err.message : 'Upload failed',
          };
          return next;
        });
        // Continue with next video instead of stopping
      }
    }

    setUploadedVideoIds(uploadedIds);

    // All uploads complete
    if (uploadedIds.length > 0) {
      // Notify parent with the first uploaded video ID
      setTimeout(() => {
        onSuccess(uploadedIds[0]);
        onClose();
      }, 1500);
    } else {
      setError('All uploads failed. Please try again.');
      setSaving(false);
    }
  }, [user, videoConfigs, validateVideoConfig, deriveCompetencyMeta, onSuccess, onClose]);

  const handleQuestionsChange = useCallback((newQuestions: QuestionFormData[]) => {
    if (!currentVideo) return;

    const prevQuestions = currentVideo.questions;
    updateCurrentVideo({ questions: newQuestions });

    // Clear assistant state for changed questions
    const changedIndices = newQuestions
      .map((q, i) => {
        const prev = prevQuestions[i];
        if (!prev) return i;
        if (
          q.statement !== prev.statement ||
          q.competencyId !== prev.competencyId ||
          q.skillId !== prev.skillId ||
          q.role !== prev.role
        ) {
          return i;
        }
        return -1;
      })
      .filter((i) => i >= 0);

    if (changedIndices.length > 0) {
      clearQuestionAssistantState(changedIndices);
    }
  }, [currentVideo, updateCurrentVideo, clearQuestionAssistantState]);

  const handleCancel = useCallback(() => {
    if (!saving) {
      onClose();
    }
  }, [saving, onClose]);

  // Computed values
  const totalVideos = videoConfigs.length;
  const completedUploads = uploadProgress.filter(p => p.stage === 'complete').length;
  const failedUploads = uploadProgress.filter(p => p.stage === 'error').length;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={handleCancel}
      />

      {/* Side Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {isOpen && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                  <UploadCloud className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {modalStep === 'select' && 'Upload Videos'}
                    {modalStep === 'configure' && `Configure Video ${currentVideoIndex + 1} of ${totalVideos}`}
                    {modalStep === 'review' && 'Review & Upload'}
                    {modalStep === 'uploading' && 'Uploading Videos'}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {modalStep === 'select' && 'Select one or more videos to upload'}
                    {modalStep === 'configure' && 'Add title, description, and questions'}
                    {modalStep === 'review' && `${totalVideos} video${totalVideos > 1 ? 's' : ''} ready to upload`}
                    {modalStep === 'uploading' && `${completedUploads} of ${totalVideos} complete`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="p-2 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="border-b border-slate-100 px-6 py-3 shrink-0">
              <div className="flex items-center justify-between">
                {[
                  { step: 1, label: 'Select Files', done: modalStep !== 'select' && totalVideos > 0 },
                  { step: 2, label: 'Configure', done: modalStep === 'review' || modalStep === 'uploading' },
                  { step: 3, label: 'Review', done: modalStep === 'uploading' },
                  { step: 4, label: 'Upload', done: completedUploads === totalVideos && totalVideos > 0 },
                ].map(({ step, label, done }, index, arr) => (
                  <div key={step} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                        done
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 text-slate-500"
                      )}>
                        {done ? <CheckCircle2 className="h-4 w-4" /> : step}
                      </div>
                      <span className={cn(
                        "mt-1 text-[10px] font-medium",
                        done ? "text-emerald-600" : "text-slate-400"
                      )}>
                        {label}
                      </span>
                    </div>
                    {index < arr.length - 1 && (
                      <div className={cn(
                        "mx-2 h-0.5 w-8 rounded transition-colors",
                        done ? "bg-emerald-300" : "bg-slate-200"
                      )} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* STEP 1: Select Files */}
              {modalStep === 'select' && (
                <>
                  {/* Dropzone */}
                  <div
                    {...getRootProps()}
                    className={cn(
                      'cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition',
                      isDragActive ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-300',
                      saving && 'pointer-events-none opacity-50'
                    )}
                  >
                    <input {...getInputProps()} />
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100">
                      <Film className="h-6 w-6 text-slate-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Drop videos here or click to browse</p>
                    <p className="mt-1 text-xs text-slate-400">MP4, MOV, AVI, WebM supported • Multiple files allowed</p>
                  </div>

                  {/* Selected Videos List */}
                  {videoConfigs.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-slate-900">
                          Selected Videos ({videoConfigs.length})
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            videoConfigs.forEach(c => URL.revokeObjectURL(c.previewUrl));
                            setVideoConfigs([]);
                          }}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="space-y-2">
                        {videoConfigs.map((config, index) => (
                          <div
                            key={`${config.file.name}-${index}`}
                            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                          >
                            <VideoThumbnail
                              src={config.previewUrl}
                              className="h-12 w-16 rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">{config.file.name}</p>
                              <p className="text-xs text-slate-500">
                                {(config.file.size / (1024 * 1024)).toFixed(2)} MB
                                {config.duration && ` • ${Math.floor(config.duration / 60)}:${String(Math.floor(config.duration % 60)).padStart(2, '0')}`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeVideo(index)}
                              className="p-1.5 rounded-lg hover:bg-slate-200 transition"
                            >
                              <Trash2 className="h-4 w-4 text-slate-400" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add more button */}
                      <button
                        type="button"
                        {...getRootProps()}
                        className="flex items-center justify-center gap-2 w-full rounded-lg border border-dashed border-slate-300 py-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 transition"
                      >
                        <Plus className="h-4 w-4" />
                        Add more videos
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* STEP 2: Configure Each Video */}
              {modalStep === 'configure' && currentVideo && (
                <>
                  {/* Video Preview */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-4">
                      <VideoThumbnail
                        src={currentVideo.previewUrl}
                        className="h-20 w-28 rounded-lg"
                        showControls
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{currentVideo.file.name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {(currentVideo.file.size / (1024 * 1024)).toFixed(2)} MB
                          {currentVideo.duration && ` • ${Math.floor(currentVideo.duration / 60)}:${String(Math.floor(currentVideo.duration % 60)).padStart(2, '0')}`}
                        </p>
                        {totalVideos > 1 && (
                          <div className="flex items-center gap-1 mt-2">
                            {videoConfigs.map((_, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  if (i < currentVideoIndex || validateCurrentVideo()) {
                                    setCurrentVideoIndex(i);
                                    setTitleError('');
                                    setError(null);
                                    setQuestionAssistants({});
                                  }
                                }}
                                className={cn(
                                  "h-1.5 rounded-full transition-all",
                                  i === currentVideoIndex
                                    ? "w-6 bg-slate-900"
                                    : videoConfigs[i].isValid
                                      ? "w-1.5 bg-emerald-400 hover:bg-emerald-500"
                                      : "w-1.5 bg-slate-300 hover:bg-slate-400"
                                )}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={currentVideo.title}
                      onChange={(e) => {
                        updateCurrentVideo({ title: e.target.value, isValid: false });
                        setTitleError('');
                      }}
                      placeholder="Enter a descriptive title"
                      disabled={saving}
                      maxLength={200}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 disabled:opacity-50"
                    />
                    {titleError && <p className="text-xs text-rose-600">{titleError}</p>}
                    <p className="text-xs text-slate-400">{currentVideo.title.length}/200 characters</p>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Description</label>
                    <textarea
                      value={currentVideo.description}
                      onChange={(e) => updateCurrentVideo({ description: e.target.value })}
                      placeholder="Describe the video content"
                      disabled={saving}
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 disabled:opacity-50 disabled:bg-slate-50"
                    />
                  </div>

                  {/* Access Control */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <label className="block text-sm font-medium text-slate-700">Access Control</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => updateCurrentVideo({ allowedOrganizations: [] })}
                        className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition ${currentVideo.allowedOrganizations.length === 0
                          ? 'border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-500'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                      >
                        <Globe className="h-5 w-5" />
                        <div className="text-xs font-medium">Global Access</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Default to first org if none selected, or keep empty to force selection
                          if (currentVideo.allowedOrganizations.length === 0 && organizations.length > 0) {
                            updateCurrentVideo({ allowedOrganizations: [organizations[0].id] });
                          }
                        }}
                        className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition ${currentVideo.allowedOrganizations.length > 0
                          ? 'border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-500'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                      >
                        <Building className="h-5 w-5" />
                        <div className="text-xs font-medium">Specific Organization</div>
                      </button>
                    </div>

                    {currentVideo.allowedOrganizations.length > 0 && (
                      <div className="mt-3">
                        <label className="mb-2 block text-xs font-medium text-slate-500">Select Organization</label>
                        <select
                          value={currentVideo.allowedOrganizations[0] || ''}
                          onChange={(e) => updateCurrentVideo({ allowedOrganizations: [e.target.value] })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                        >
                          {organizations.map((org) => (
                            <option key={org.id} value={org.id}>
                              {org.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Campaign Selection */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Add to Campaign <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <p className="text-xs text-slate-500">
                      Assign this video to an existing campaign for assessments.
                    </p>
                    {loadingCampaigns ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                        Loading campaigns...
                      </div>
                    ) : campaigns.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                        No campaigns yet. You can add this video to a campaign later.
                      </div>
                    ) : (
                      <select
                        value={currentVideo.campaignId}
                        onChange={(e) => updateCurrentVideo({ campaignId: e.target.value })}
                        disabled={saving}
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 disabled:opacity-50"
                      >
                        <option value="">Select a campaign...</option>
                        {campaigns.map((campaign) => (
                          <option key={campaign.id} value={campaign.id}>
                            {campaign.title} ({campaign.items.length} videos)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Auto-generated Tags */}
                  {selectedTags.length > 0 && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">Auto-generated tags</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Questions Section */}
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-medium text-slate-900">Assessment Questions</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Add the three DI Code prompts to use this video in campaigns.
                      </p>
                    </div>
                    <QuestionBuilder
                      questions={currentVideo.questions}
                      onChange={handleQuestionsChange}
                      disabled={saving}
                      competencyOptions={competencies}
                      questionAssist={{
                        state: questionAssistants,
                        onGenerate: handleGenerateQuestion,
                        onValidate: handleValidateQuestion,
                        onApplySuggestion: handleApplySuggestion,
                      }}
                    />
                  </div>

                  {/* Campaign Selection */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Add to Campaign <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <p className="text-xs text-slate-500">
                      Assign this video to an existing campaign for assessments.
                    </p>
                    {loadingCampaigns ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                        Loading campaigns…
                      </div>
                    ) : campaigns.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                        No campaigns yet. You can add this video to a campaign later.
                      </div>
                    ) : (
                      <select
                        value={currentVideo.campaignId}
                        onChange={(e) => updateCurrentVideo({ campaignId: e.target.value })}
                        disabled={saving}
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 disabled:opacity-50"
                      >
                        <option value="">Select a campaign…</option>
                        {campaigns.map((campaign) => (
                          <option key={campaign.id} value={campaign.id}>
                            {campaign.title} ({campaign.items.length} videos)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Error State */}
                  {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-rose-600" />
                        <p className="text-sm font-medium text-rose-900">{error}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* STEP 3: Review */}
              {modalStep === 'review' && (
                <>
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-slate-900">Ready to Upload</h3>
                    <p className="text-xs text-slate-500">
                      Review your videos before uploading. Click on a video to edit it.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {videoConfigs.map((config, index) => (
                      <button
                        key={`${config.file.name}-${index}`}
                        type="button"
                        onClick={() => {
                          setCurrentVideoIndex(index);
                          setModalStep('configure');
                        }}
                        className="w-full flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition text-left"
                      >
                        <VideoThumbnail
                          src={config.previewUrl}
                          className="h-14 w-20 rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{config.title}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {config.questions.filter(q => q.statement.trim()).length} questions
                            {config.campaignId && ` • Campaign assigned`}
                          </p>
                        </div>
                        <div className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full",
                          config.isValid ? "bg-emerald-100" : "bg-amber-100"
                        )}>
                          {config.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-semibold text-slate-900">{totalVideos}</p>
                        <p className="text-xs text-slate-500">Videos</p>
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-slate-900">
                          {videoConfigs.reduce((sum, c) => sum + c.questions.filter(q => q.statement.trim()).length, 0)}
                        </p>
                        <p className="text-xs text-slate-500">Questions</p>
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-slate-900">
                          {videoConfigs.filter(c => c.campaignId).length}
                        </p>
                        <p className="text-xs text-slate-500">With Campaign</p>
                      </div>
                    </div>
                  </div>

                  {/* Error State */}
                  {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-rose-600" />
                        <p className="text-sm font-medium text-rose-900">{error}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* STEP 4: Uploading */}
              {modalStep === 'uploading' && (
                <>
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-slate-900">Upload Progress</h3>
                    <p className="text-xs text-slate-500">
                      Uploading {totalVideos} video{totalVideos > 1 ? 's' : ''}...
                    </p>
                  </div>

                  {/* Overall Progress */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Overall Progress</span>
                      <span className="text-sm text-slate-500">
                        {completedUploads}/{totalVideos} complete
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${(completedUploads / totalVideos) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Individual Progress */}
                  <div className="space-y-3">
                    {videoConfigs.map((config, index) => (
                      <div
                        key={`${config.file.name}-${index}`}
                        className={cn(
                          "rounded-xl border p-4 transition",
                          uploadProgress[index]?.stage === 'complete'
                            ? "border-emerald-200 bg-emerald-50"
                            : uploadProgress[index]?.stage === 'error'
                              ? "border-rose-200 bg-rose-50"
                              : index === currentUploadIndex
                                ? "border-slate-300 bg-white"
                                : "border-slate-200 bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <VideoThumbnail
                            src={config.previewUrl}
                            className="h-10 w-14 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{config.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {uploadProgress[index]?.message || 'Waiting...'}
                            </p>
                            {uploadProgress[index] && uploadProgress[index].stage !== 'complete' && uploadProgress[index].stage !== 'error' && uploadProgress[index].stage !== 'idle' && (
                              <div className="mt-2 h-1 rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-slate-900 transition-all duration-300"
                                  style={{ width: `${uploadProgress[index].progress}%` }}
                                />
                              </div>
                            )}
                          </div>
                          <div className="shrink-0">
                            {uploadProgress[index]?.stage === 'complete' ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            ) : uploadProgress[index]?.stage === 'error' ? (
                              <AlertCircle className="h-5 w-5 text-rose-600" />
                            ) : index === currentUploadIndex ? (
                              <Loader2 className="h-5 w-5 text-slate-600 animate-spin" />
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-slate-300" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Result Summary */}
                  {completedUploads + failedUploads === totalVideos && (
                    <div className={cn(
                      "rounded-xl border p-4",
                      failedUploads === 0
                        ? "border-emerald-200 bg-emerald-50"
                        : failedUploads === totalVideos
                          ? "border-rose-200 bg-rose-50"
                          : "border-amber-200 bg-amber-50"
                    )}>
                      <div className="flex items-center gap-3">
                        {failedUploads === 0 ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            <p className="text-sm font-medium text-emerald-900">
                              All videos uploaded successfully!
                            </p>
                          </>
                        ) : failedUploads === totalVideos ? (
                          <>
                            <AlertCircle className="h-5 w-5 text-rose-600" />
                            <p className="text-sm font-medium text-rose-900">
                              All uploads failed. Please try again.
                            </p>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                            <p className="text-sm font-medium text-amber-900">
                              {completedUploads} uploaded, {failedUploads} failed
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 shrink-0 bg-slate-50">
              <div className="flex items-center justify-between">
                {/* Back Button */}
                <div>
                  {modalStep === 'configure' && (
                    <button
                      type="button"
                      onClick={currentVideoIndex === 0 ? backToSelection : goToPrevVideo}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {currentVideoIndex === 0 ? 'Back' : 'Previous'}
                    </button>
                  )}
                  {modalStep === 'review' && (
                    <button
                      type="button"
                      onClick={backToConfigure}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Edit Videos
                    </button>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  {modalStep !== 'uploading' && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={saving}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}

                  {modalStep === 'select' && (
                    <button
                      type="button"
                      onClick={startConfiguring}
                      disabled={videoConfigs.length === 0}
                      className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      Continue
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}

                  {modalStep === 'configure' && (
                    <button
                      type="button"
                      onClick={goToNextVideo}
                      className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                    >
                      {currentVideoIndex < totalVideos - 1 ? 'Next Video' : 'Review All'}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}

                  {modalStep === 'review' && (
                    <button
                      type="button"
                      onClick={handleUploadAll}
                      disabled={saving}
                      className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      Upload {totalVideos} Video{totalVideos > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default UploadVideoModal;
