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
} from 'lucide-react';
import type { QuestionFormData, Campaign } from '@/lib/types';
import { Field, FieldError } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import QuestionBuilder from '@/components/Questions/QuestionBuilder';
import { validateQuestionSet } from '@/lib/questionValidation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { getCampaignsByUser, createVideo, createCampaignItem, getCampaign, logActivity } from '@/lib/firestore';
import { uploadVideo, uploadVideoBlob, generateVideoPath } from '@/lib/storage';
import { extractThumbnail, getVideoDuration } from '@/lib/videoUtils';
import { buildTagList } from '@/lib/competencies';
import { useCompetencies } from '@/hooks/useCompetencies';
import { createDefaultQuestionSet, normalizeQuestionSet } from '@/lib/questionDefaults';
import { generateQuestion, validateQuestion, type GenerateQuestionResponse, type ValidateQuestionResponse } from '@/lib/questionTools';
import type { QuestionAssistantState } from '@/types/questionAssist';
import { convertFormDataToQuestions } from '@/lib/questionUtils';

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

interface UploadProgress {
  stage: UploadStage;
  progress: number;
  message: string;
}

export function UploadVideoModal({
  isOpen,
  onClose,
  onSuccess,
}: UploadVideoModalProps) {
  const { user } = useAuth();
  const { competencies } = useCompetencies();
  
  // File state
  const [file, setFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  
  // Metadata state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionFormData[]>([]);
  
  // Campaign state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  
  // Upload state
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: 'idle',
    progress: 0,
    message: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Validation state
  const [titleError, setTitleError] = useState('');
  
  // Question assistant state
  const [questionAssistants, setQuestionAssistants] = useState<Record<number, QuestionAssistantState>>({});

  // Initialize questions on mount
  useEffect(() => {
    if (isOpen && questions.length === 0) {
      setQuestions(createDefaultQuestionSet());
    }
  }, [isOpen, questions.length]);

  // Load user's campaigns
  useEffect(() => {
    if (isOpen && user) {
      setLoadingCampaigns(true);
      getCampaignsByUser(user.uid)
        .then((userCampaigns) => {
          setCampaigns(userCampaigns);
        })
        .catch((error) => {
          console.error('Failed to load campaigns:', error);
        })
        .finally(() => {
          setLoadingCampaigns(false);
        });
    }
  }, [isOpen, user]);

  // Clean up video preview URL on unmount
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setVideoPreviewUrl(null);
      setVideoDuration(null);
      setTitle('');
      setDescription('');
      setQuestions([]);
      setSelectedCampaignId('');
      setUploadProgress({ stage: 'idle', progress: 0, message: '' });
      setSaving(false);
      setError(null);
      setTitleError('');
      setQuestionAssistants({});
    }
  }, [isOpen]);

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'video/*': ['.mp4', '.mov', '.avi', '.webm', '.mkv'] },
    multiple: false,
    disabled: saving,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const videoFile = acceptedFiles[0];
        setFile(videoFile);
        setError(null);
        
        // Create preview URL
        const previewUrl = URL.createObjectURL(videoFile);
        setVideoPreviewUrl(previewUrl);
        
        // Auto-fill title from filename
        const nameWithoutExt = videoFile.name.replace(/\.[^/.]+$/, '');
        const cleanTitle = nameWithoutExt.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!title) {
          setTitle(cleanTitle);
        }
        
        // Extract duration
        try {
          const duration = await getVideoDuration(videoFile);
          setVideoDuration(duration);
        } catch (err) {
          console.warn('Failed to extract video duration:', err);
        }
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

  const questionSelections = useMemo(() => deriveCompetencyMeta(questions), [questions, deriveCompetencyMeta]);
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
  }, []);

  const updateQuestionStatement = useCallback((index: number, statement: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], statement };
      }
      return next;
    });
  }, []);

  const handleGenerateQuestion = useCallback(
    async (index: number) => {
      const question = questions[index];
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
          videoTitle: title || undefined,
          scenarioDescription: description || undefined,
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
    [questions, questionAssistants, resolveQuestionContext, title, description, updateQuestionAssistantState, updateQuestionStatement]
  );

  const handleValidateQuestion = useCallback(
    async (index: number) => {
      const question = questions[index];
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
    [questions, questionAssistants, resolveQuestionContext, updateQuestionAssistantState]
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

  // Validation
  const validate = useCallback(() => {
    setTitleError('');
    setError(null);

    if (!file) {
      setError('Please select a video file');
      return false;
    }

    if (!title.trim()) {
      setTitleError('Title is required');
      return false;
    }

    if (title.trim().length > 200) {
      setTitleError('Title must be 200 characters or less');
      return false;
    }

    const questionErrors = validateQuestionSet(questions);
    if (questionErrors.length > 0) {
      setError('Please complete all required question fields');
      return false;
    }

    // Check behavioral questions have competency/skill
    const missingMeta = questions.some(
      (q) =>
        (q.type === 'behavioral-perception' || q.type === 'behavioral-intent') &&
        (!q.competencyId || !q.skillId)
    );
    if (missingMeta) {
      setError('Please select competency and skill for all behavioral questions');
      return false;
    }

    return true;
  }, [file, title, questions]);

  // Upload handler
  const handleUpload = useCallback(async () => {
    if (!user || !file || !validate()) return;

    setSaving(true);
    setError(null);

    try {
      // Stage 1: Extract metadata (thumbnail & duration)
      setUploadProgress({
        stage: 'extracting_metadata',
        progress: 5,
        message: 'Extracting video metadata...',
      });

      let thumbnailBlob: Blob | null = null;
      let duration = videoDuration;

      try {
        thumbnailBlob = await extractThumbnail(file, 1);
        if (!duration) {
          duration = await getVideoDuration(file);
        }
      } catch (err) {
        console.warn('Failed to extract thumbnail:', err);
        // Continue without thumbnail
      }

      // Stage 2: Upload video
      setUploadProgress({
        stage: 'uploading_video',
        progress: 10,
        message: 'Uploading video...',
      });

      const videoPath = generateVideoPath(user.uid, file.name);
      const videoUrl = await uploadVideo(file, videoPath, (progress) => {
        setUploadProgress({
          stage: 'uploading_video',
          progress: 10 + progress * 0.6, // 10-70%
          message: `Uploading video... ${Math.round(progress)}%`,
        });
      });

      // Stage 3: Upload thumbnail
      let thumbnailUrl: string | undefined;
      if (thumbnailBlob) {
        setUploadProgress({
          stage: 'uploading_thumbnail',
          progress: 75,
          message: 'Uploading thumbnail...',
        });

        const thumbnailPath = videoPath.replace(/\.[^/.]+$/, '_thumb.jpg');
        thumbnailUrl = await uploadVideoBlob(thumbnailBlob, thumbnailPath, {
          contentType: 'image/jpeg',
        });
      }

      // Stage 4: Save to Firestore
      setUploadProgress({
        stage: 'saving_metadata',
        progress: 85,
        message: 'Saving video metadata...',
      });

      // Build tags from competencies/skills
      const tags = ['uploaded', ...selectedTags];

      // Convert questions to the format expected by Firestore
      const convertedQuestions = convertFormDataToQuestions(questions);

      const videoId = await createVideo(user.uid, {
        title: title.trim(),
        description: description.trim() || undefined,
        storageUrl: videoUrl,
        thumbnailUrl,
        source: 'uploaded',
        duration: duration || undefined,
        questions: convertedQuestions,
        tags,
      });

      // Stage 5: Add to campaign if selected
      if (selectedCampaignId) {
        setUploadProgress({
          stage: 'adding_to_campaign',
          progress: 92,
          message: 'Adding to campaign...',
        });

        const campaign = await getCampaign(selectedCampaignId);
        if (campaign) {
          const order = campaign.items.length;
          await createCampaignItem(selectedCampaignId, videoId, order);
        }
      }

      // Log activity
      await logActivity({
        action: 'video_uploaded',
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || undefined,
        resourceId: videoId,
        resourceName: title.trim(),
        resourceType: 'video',
        metadata: {
          duration,
          hasThumbnail: !!thumbnailUrl,
          hasQuestions: questions.length > 0,
          campaignId: selectedCampaignId || undefined,
        },
      });

      // Complete
      setUploadProgress({
        stage: 'complete',
        progress: 100,
        message: 'Video uploaded successfully!',
      });

      // Notify parent and close
      setTimeout(() => {
        onSuccess(videoId);
        onClose();
      }, 1000);

    } catch (err) {
      console.error('Upload failed:', err);
      setUploadProgress({
        stage: 'error',
        progress: 0,
        message: '',
      });
      setError(err instanceof Error ? err.message : 'Failed to upload video. Please try again.');
      setSaving(false);
    }
  }, [
    user,
    file,
    validate,
    videoDuration,
    title,
    description,
    questions,
    selectedTags,
    selectedCampaignId,
    onSuccess,
    onClose,
  ]);

  const handleCancel = useCallback(() => {
    if (!saving) {
      onClose();
    }
  }, [saving, onClose]);

  const handleQuestionsChange = useCallback((newQuestions: QuestionFormData[]) => {
    setQuestions(newQuestions);
    // Clear assistant state for changed questions
    const changedIndices = newQuestions
      .map((q, i) => {
        const prev = questions[i];
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
  }, [questions, clearQuestionAssistantState]);

  const isUploading = saving && uploadProgress.stage !== 'idle' && uploadProgress.stage !== 'error';

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleCancel}
      />
      
      {/* Side Panel */}
      <div 
        className={`fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
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
                  <h2 className="text-lg font-semibold text-slate-900">Upload Video</h2>
                  <p className="text-sm text-slate-500">Add a video to your library</p>
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* File Dropzone */}
              <div
                {...getRootProps()}
                className={cn(
                  'cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition',
                  isDragActive ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-300',
                  saving && 'pointer-events-none opacity-50'
                )}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="space-y-3">
                    {videoPreviewUrl && (
                      <video
                        src={videoPreviewUrl}
                        className="mx-auto h-28 rounded-lg bg-black"
                        muted
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-700">{file.name}</p>
                      <p className="text-xs text-slate-500">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                        {videoDuration && ` • ${Math.floor(videoDuration / 60)}:${String(Math.floor(videoDuration % 60)).padStart(2, '0')}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setVideoPreviewUrl(null);
                        setVideoDuration(null);
                      }}
                      disabled={saving}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Choose different file
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                      <Film className="h-5 w-5 text-slate-600" />
                    </div>
                    <p className="text-sm text-slate-600">Drop your video here or click to browse</p>
                    <p className="mt-1 text-xs text-slate-400">MP4, MOV, AVI, WebM supported</p>
                  </>
                )}
              </div>

              {/* Title */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleError('');
                  }}
                  placeholder="Enter a descriptive title"
                  disabled={saving}
                  maxLength={200}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 disabled:opacity-50"
                />
                {titleError && <p className="text-xs text-rose-600">{titleError}</p>}
                <p className="text-xs text-slate-400">{title.length}/200 characters</p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the scenario or context (optional)"
                  disabled={saving}
                  maxLength={1000}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 disabled:opacity-50"
                />
                <p className="text-xs text-slate-400">{description.length}/1000 characters</p>
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
                  questions={questions}
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
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
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

              {/* Upload Progress */}
              {isUploading && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{uploadProgress.message}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-slate-900 transition-all duration-300"
                          style={{ width: `${uploadProgress.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Success State */}
              {uploadProgress.stage === 'complete' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-900">{uploadProgress.message}</p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-rose-600" />
                    <p className="text-sm font-medium text-rose-900">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 shrink-0 bg-slate-50">
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={saving || !file || !title.trim()}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? 'Uploading…' : 'Upload Video'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default UploadVideoModal;

