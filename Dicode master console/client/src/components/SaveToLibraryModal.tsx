'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { X, CheckCircle2, Circle, Plus } from 'lucide-react';
import type { VideoItem } from '@/utils/video';
import type { QuestionFormData, Campaign } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field, FieldError } from '@/components/ui/field';
import QuestionBuilder from '@/components/Questions/QuestionBuilder';
import { validateQuestionSet } from '@/lib/questionValidation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { getCampaignsByUser } from '@/lib/firestore';
import { buildTagList, type CompetencyDefinition } from '@/lib/competencies';
import { useCompetencies } from '@/hooks/useCompetencies';
import { createDefaultQuestionSet, normalizeQuestionSet } from '@/lib/questionDefaults';
import { generateQuestion, validateQuestion, type GenerateQuestionResponse, type ValidateQuestionResponse } from '@/lib/questionTools';
import type { QuestionAssistantState } from '@/types/questionAssist';

export interface SaveMetadata {
  title: string;
  description?: string;
  questions?: QuestionFormData[];
  campaignId?: string;
  tags: string[];
}

interface VideoMetadataState {
  title: string;
  description: string;
  questions: QuestionFormData[];
  isComplete: boolean;
}

export interface SaveToLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoItem[]; // Changed from single video to array
  onSaveAll: (metadataList: SaveMetadata[]) => Promise<void>;
  saving: boolean;
}

export function SaveToLibraryModal({
  isOpen,
  onClose,
  videos,
  onSaveAll,
  saving,
}: SaveToLibraryModalProps) {
  const { user } = useAuth();
  const { competencies } = useCompetencies();
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [videoMetadata, setVideoMetadata] = useState<Record<string, VideoMetadataState>>({});
  const [titleError, setTitleError] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [questionAssistants, setQuestionAssistants] = useState<
    Record<string, Record<number, QuestionAssistantState>>
  >({});

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

  // Initialize metadata state for all videos
  useEffect(() => {
    if (!isOpen || videos.length === 0) return;

    setVideoMetadata((prev) => {
      const next = { ...prev };

      videos.forEach((video) => {
        const existing = prev[video.id];
        if (existing) {
          next[video.id] = {
            ...existing,
            questions: normalizeQuestionSet(existing.questions),
          };
        } else {
          next[video.id] = {
            title: video.title?.trim() || '',
            description: '',
            questions: createDefaultQuestionSet(),
            isComplete: false,
          };
        }
      });

      return next;
    });
  }, [isOpen, videos]);

  const currentVideo = videos[activeTabIndex];
  const currentMetadata = currentVideo ? videoMetadata[currentVideo.id] : undefined;
  const deriveCompetencyMeta = useCallback(
    (questions: QuestionFormData[]) => {
      const competencyIds = new Set<string>();
      const skillsMap: Record<string, string[]> = {};

      questions.forEach((question) => {
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
    },
    [],
  );

  const currentQuestionSelections = useMemo(() => {
    if (!currentMetadata) {
      return {
        selectedCompetencies: [],
        selectedSkills: {},
      };
    }
    return deriveCompetencyMeta(currentMetadata.questions);
  }, [currentMetadata, deriveCompetencyMeta]);

  const selectedTags = useMemo(
    () =>
      buildTagList(
        currentQuestionSelections.selectedCompetencies,
        currentQuestionSelections.selectedSkills,
      ),
    [currentQuestionSelections],
  );

  const questionCompetencyOptions = competencies;

  const clearQuestionAssistantState = useCallback((videoId: string, indices?: number[]) => {
    setQuestionAssistants((prev) => {
      const target = prev[videoId];
      if (!target) return prev;

      if (!indices || indices.length === 0) {
        const next = { ...prev };
        delete next[videoId];
        return next;
      }

      let changed = false;
      const nextVideoState = { ...target };
      indices.forEach((index) => {
        if (Object.prototype.hasOwnProperty.call(nextVideoState, index)) {
          changed = true;
          delete nextVideoState[index];
        }
      });
      if (!changed) return prev;

      const next = { ...prev };
      if (Object.keys(nextVideoState).length === 0) {
        delete next[videoId];
      } else {
        next[videoId] = nextVideoState;
      }
      return next;
    });
  }, []);

  const updateQuestionAssistantState = useCallback(
    (videoId: string, index: number, updates: Partial<QuestionAssistantState>) => {
      setQuestionAssistants((prev) => {
        const videoState = prev[videoId] ?? {};
        const nextVideoState = {
          ...videoState,
          [index]: {
            ...videoState[index],
            ...updates,
          },
        };
        return {
          ...prev,
          [videoId]: nextVideoState,
        };
      });
    },
    [],
  );

  const updateCurrentMetadata = useCallback(
    (updates: Partial<VideoMetadataState>) => {
      if (!currentVideo) return;
      const changedQuestionIndices: number[] = [];

      setVideoMetadata((prev) => {
        const existing = prev[currentVideo.id];
        if (!existing) return prev;

        if (updates.questions && existing.questions) {
          updates.questions.forEach((question, index) => {
            const previous = existing.questions[index];
            if (
              !previous ||
              question.statement !== previous.statement ||
              question.competencyId !== previous.competencyId ||
              question.skillId !== previous.skillId ||
              question.role !== previous.role
            ) {
              changedQuestionIndices.push(index);
            }
          });
        }

        return {
        ...prev,
        [currentVideo.id]: {
            ...existing,
          ...updates,
        },
        };
      });

      if (changedQuestionIndices.length > 0) {
        clearQuestionAssistantState(currentVideo.id, changedQuestionIndices);
      }
    },
    [currentVideo, clearQuestionAssistantState],
  );

  const validateCurrentVideo = useCallback(() => {
    if (!currentMetadata) return false;

    // Validate title
    if (!currentMetadata.title.trim()) {
      setTitleError('Title is required');
      return false;
    }
    if (currentMetadata.title.trim().length > 200) {
      setTitleError('Title must be 200 characters or less');
      return false;
    }
    setTitleError('');

    const questionErrors = validateQuestionSet(currentMetadata.questions as QuestionFormData[]);
    if (questionErrors.length > 0) {
        return false;
    }

    return true;
  }, [currentMetadata]);

  const handleMarkComplete = useCallback(() => {
    if (!validateCurrentVideo()) return;
    updateCurrentMetadata({ isComplete: true });
  }, [validateCurrentVideo, updateCurrentMetadata]);

  const handleSaveAll = useCallback(async () => {
    // Check all videos are complete
    const allComplete = videos.every((video) => videoMetadata[video.id]?.isComplete);
    if (!allComplete) {
      alert('Please complete all videos before saving');
      return;
    }

    const questionIssues: string[] = [];

    videos.forEach((video, videoIndex) => {
      const meta = videoMetadata[video.id];
      if (!meta) return;
      meta.questions.forEach((question, questionIndex) => {
        if (question.type === 'behavioral-perception' || question.type === 'behavioral-intent') {
          if (!question.competencyId) {
            questionIssues.push(`Video ${videoIndex + 1} · Q${questionIndex + 1}: select a competency`);
          }
          if (!question.skillId) {
            questionIssues.push(`Video ${videoIndex + 1} · Q${questionIndex + 1}: select a skill`);
          }
        }
      });
    });

    if (questionIssues.length > 0) {
      alert(`Please complete the question metadata:\n${questionIssues.join('\n')}`);
      return;
    }

    // Campaign is now optional - videos with questions can exist independently
    // No validation needed for campaign selection

    // Prepare metadata list
    const metadataList: SaveMetadata[] = videos.map((video) => {
      const meta = videoMetadata[video.id];
      const selections = deriveCompetencyMeta(meta.questions);
      const sanitizedQuestions: QuestionFormData[] = meta.questions.map((question) => {
        const sanitized: QuestionFormData = { ...question };
        if (sanitized.type === 'qualitative') {
          delete sanitized.competency;
          delete sanitized.competencyId;
          delete sanitized.skillId;
        } else {
          if (!sanitized.competency) {
            sanitized.competency = '';
          }
        }

        if (sanitized.competencyId === undefined) {
          delete sanitized.competencyId;
        }
        if (sanitized.skillId === undefined) {
          delete sanitized.skillId;
        }

        return sanitized;
      });

      const payload: SaveMetadata = {
        title: meta.title.trim(),
        questions: sanitizedQuestions,
        tags: buildTagList(selections.selectedCompetencies, selections.selectedSkills),
      };

      const trimmedDescription = meta.description.trim();
      if (trimmedDescription.length > 0) {
        payload.description = trimmedDescription;
      }

      if (selectedCampaignId) {
        payload.campaignId = selectedCampaignId;
      }

      return payload;
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('[SaveToLibraryModal] Payload preview:', metadataList);
    }

    await onSaveAll(metadataList);
  }, [videos, videoMetadata, selectedCampaignId, onSaveAll, deriveCompetencyMeta]);

  const handleCancel = useCallback(() => {
    if (!saving) {
      onClose();
    }
  }, [saving, onClose]);

  const handleTabClick = useCallback((index: number) => {
    setActiveTabIndex(index);
    setTitleError('');
  }, []);

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

  const updateQuestionStatement = useCallback(
    (videoId: string, questionIndex: number, statement: string) => {
      setVideoMetadata((prev) => {
        const existing = prev[videoId];
        if (!existing) return prev;

        const questions = [...existing.questions];
        if (!questions[questionIndex]) return prev;

        questions[questionIndex] = {
          ...questions[questionIndex],
          statement,
        };

        return {
          ...prev,
          [videoId]: {
            ...existing,
            questions,
          },
        };
      });
    },
    [],
  );

  const handleGenerateQuestion = useCallback(
    async (videoId: string, questionIndex: number) => {
      const metadata = videoMetadata[videoId];
      const question = metadata?.questions?.[questionIndex];
      if (!metadata || !question) return;

      const state = questionAssistants[videoId]?.[questionIndex];
      if (state?.isGenerating) return;

      updateQuestionAssistantState(videoId, questionIndex, {
        isGenerating: true,
        error: null,
        suggestedRewrite: null,
        issues: [],
        severity: undefined,
      });

      const { competencyName, skillName } = resolveQuestionContext(question);
      const sourceVideo = videos.find((video) => video.id === videoId);
      const videoTitle = metadata.title?.trim() || sourceVideo?.title || undefined;
      const scenarioDescription =
        metadata.description?.trim() || sourceVideo?.prompt || undefined;

      try {
        const result: GenerateQuestionResponse = await generateQuestion({
          role: question.role,
          competency: competencyName,
          skillName,
          videoTitle,
          scenarioDescription,
        });

        updateQuestionStatement(videoId, questionIndex, result.question.trim());
        updateQuestionAssistantState(videoId, questionIndex, {
          isGenerating: false,
          error: null,
          explanation: result.explanation,
          issues: [],
          severity: undefined,
          suggestedRewrite: null,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to generate question';
        updateQuestionAssistantState(videoId, questionIndex, {
          isGenerating: false,
          error: message,
        });
      }
    },
    [
      questionAssistants,
      resolveQuestionContext,
      updateQuestionAssistantState,
      updateQuestionStatement,
      videoMetadata,
      videos,
    ],
  );

  const handleValidateQuestion = useCallback(
    async (videoId: string, questionIndex: number) => {
      const metadata = videoMetadata[videoId];
      const question = metadata?.questions?.[questionIndex];
      if (!metadata || !question) return;

      if (!question.statement.trim()) {
        updateQuestionAssistantState(videoId, questionIndex, {
          error: 'Enter a question before validating.',
        });
        return;
      }

      const state = questionAssistants[videoId]?.[questionIndex];
      if (state?.isValidating) return;

      const now = Date.now();
      if (state?.lastValidatedAt && now - state.lastValidatedAt < 1500) {
        return;
      }

      updateQuestionAssistantState(videoId, questionIndex, {
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

        updateQuestionAssistantState(videoId, questionIndex, {
          isValidating: false,
          issues: result.issues,
          severity: result.severity,
          suggestedRewrite: result.suggestedRewrite,
          error: null,
          lastValidatedAt: Date.now(),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to validate question';
        updateQuestionAssistantState(videoId, questionIndex, {
          isValidating: false,
          error: message,
        });
      }
    },
    [questionAssistants, resolveQuestionContext, updateQuestionAssistantState, videoMetadata],
  );

  const handleApplySuggestion = useCallback(
    (videoId: string, questionIndex: number) => {
      const suggestion = questionAssistants[videoId]?.[questionIndex]?.suggestedRewrite;
      if (!suggestion) return;
      updateQuestionStatement(videoId, questionIndex, suggestion.trim());
      clearQuestionAssistantState(videoId, [questionIndex]);
    },
    [clearQuestionAssistantState, questionAssistants, updateQuestionStatement],
  );

  // Extract quality as a typed variable
  const qualityValue = currentVideo && typeof currentVideo.quality === 'string' ? currentVideo.quality : null;
  const allComplete = videos.every((video) => videoMetadata[video.id]?.isComplete);
  const completedCount = videos.filter((v) => videoMetadata[v.id]?.isComplete).length;

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
        {isOpen && currentVideo && currentMetadata && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Save to Library
                  </h2>
                  <p className="text-sm text-slate-500">
                    {videos.length} video{videos.length > 1 ? 's' : ''} generated
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

            {/* Video Tabs (for multiple videos) */}
            {videos.length > 1 && (
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 shrink-0">
                <div className="flex items-center gap-2 overflow-x-auto">
                  {videos.map((video, index) => {
                    const meta = videoMetadata[video.id];
                    const isComplete = meta?.isComplete || false;
                    const isActive = index === activeTabIndex;

                    return (
                      <button
                        key={video.id}
                        onClick={() => handleTabClick(index)}
                        disabled={saving}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap',
                          isActive
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50',
                          saving && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-slate-300" />
                        )}
                        <span>Video {index + 1}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Video Reference Info */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Video Reference</p>
                  <p className="font-mono text-xs text-slate-600 mt-1">{currentVideo.id}</p>
                  {qualityValue && (
                    <p className="text-xs text-slate-500 mt-1">
                      Quality: <span className="font-medium text-slate-700">{qualityValue}</span>
                    </p>
                  )}
                </div>
                {currentMetadata.isComplete && (
                  <div className="flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Ready
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentMetadata.title}
                  onChange={(e) => updateCurrentMetadata({ title: e.target.value })}
                  placeholder="Enter a descriptive title"
                  disabled={saving || currentMetadata.isComplete}
                  maxLength={200}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 disabled:opacity-50 disabled:bg-slate-50"
                />
                {titleError && <p className="text-xs text-rose-600">{titleError}</p>}
                <p className="text-xs text-slate-400">{currentMetadata.title.length}/200 characters</p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={currentMetadata.description}
                  onChange={(e) => updateCurrentMetadata({ description: e.target.value })}
                  placeholder="Describe the scenario or context (optional)"
                  disabled={saving || currentMetadata.isComplete}
                  maxLength={1000}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 disabled:opacity-50 disabled:bg-slate-50"
                />
                <p className="text-xs text-slate-400">{currentMetadata.description.length}/1000 characters</p>
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
                    Each video includes the three DI Code prompts (perception, intent, qualitative).
                  </p>
                </div>
                <QuestionBuilder
                  questions={currentMetadata.questions}
                  onChange={(questions: QuestionFormData[]) => updateCurrentMetadata({ questions })}
                  disabled={saving || currentMetadata.isComplete}
                  competencyOptions={questionCompetencyOptions}
                  questionAssist={{
                    state: questionAssistants[currentVideo.id] || {},
                    onGenerate: (index) => handleGenerateQuestion(currentVideo.id, index),
                    onValidate: (index) => handleValidateQuestion(currentVideo.id, index),
                    onApplySuggestion: (index) => handleApplySuggestion(currentVideo.id, index),
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
                    No campaigns yet. You can add videos to a campaign later.
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
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 shrink-0 bg-slate-50">
              <div className="flex items-center justify-between gap-3">
                {/* Progress indicator */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>{completedCount} of {videos.length} ready</span>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                  {currentMetadata.isComplete ? (
                    <button
                      type="button"
                      onClick={() => updateCurrentMetadata({ isComplete: false })}
                      disabled={saving}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Edit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleMarkComplete}
                      disabled={saving || !currentMetadata.title.trim()}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Mark Complete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveAll}
                    disabled={saving || !allComplete}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : `Save All (${videos.length})`}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
