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
import { COMPETENCIES, buildTagList, type CompetencyDefinition } from '@/lib/competencies';
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

  const questionCompetencyOptions = COMPETENCIES;

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

    const competency = COMPETENCIES.find((entry) => entry.id === question.competencyId);
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

  if (!isOpen || !currentVideo || !currentMetadata) return null;

  // Extract quality as a typed variable
  const qualityValue = typeof currentVideo.quality === 'string' ? currentVideo.quality : null;
  const allComplete = videos.every((video) => videoMetadata[video.id]?.isComplete);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleCancel} />

      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Library save</p>
            <h2 className="text-xl font-semibold text-slate-900">
              Save {videos.length} video{videos.length > 1 ? 's' : ''} to library
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {videos.length > 1 && (
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex min-h-[44px] items-center gap-2">
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
                      'flex h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
                      isActive
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700',
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

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {/* Video Preview Info */}
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Video reference</p>
            <p className="font-mono text-xs text-slate-600">{currentVideo.id}</p>
            {qualityValue && (
              <p className="mt-1 text-xs text-slate-500">
                Quality preset: <span className="font-medium text-slate-800">{qualityValue}</span>
              </p>
            )}
            {currentMetadata.isComplete && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Ready to save
              </div>
            )}
          </div>

          {/* Title & Description Combined */}
          <div className="rounded-[32px] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <input
              id="video-title"
              value={currentMetadata.title}
              onChange={(e) => updateCurrentMetadata({ title: e.target.value })}
                placeholder="Title (required)"
              disabled={saving || currentMetadata.isComplete}
              maxLength={200}
                className="w-full border-none bg-transparent text-lg font-medium text-slate-900 outline-none placeholder:text-slate-400 disabled:text-slate-400"
            />
            {titleError && <FieldError>{titleError}</FieldError>}
              <p className="mt-2 text-xs text-slate-400">
                {currentMetadata.title.length}/200 characters
              </p>
            </div>
            <div className="px-5 py-4">
            <textarea
              id="video-description"
              value={currentMetadata.description}
              onChange={(e) => updateCurrentMetadata({ description: e.target.value })}
                placeholder="Description (optional)"
              disabled={saving || currentMetadata.isComplete}
              maxLength={1000}
              rows={4}
                className="w-full border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:text-slate-400"
            />
              <p className="mt-2 text-xs text-slate-400">
                {currentMetadata.description.length}/1000 characters
              </p>
            </div>
            </div>

          {selectedTags.length > 0 && (
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Auto-generated tags
              </p>
              <p className="text-sm text-slate-500">
                Based on the competencies and skills you apply to each question.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-slate-900/5 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

          {/* Questions */}
          <div className="space-y-3">
              <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Assessment questions</p>
              <p className="text-sm text-slate-500">
                Each saved video ships with the three DI Code prompts (perception, intent, qualitative).
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

          {/* Campaign Selection - Now optional for all videos */}
          <Field>
            <Label htmlFor="campaign-select" className="text-slate-700">
              Campaign (optional)
            </Label>
            <p className="mb-2 text-xs text-slate-400">
              Add to a campaign when you want this video tied to assessments or launch dashboards.
            </p>
            {loadingCampaigns ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
                Loading campaigns…
              </div>
            ) : campaigns.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                No campaigns yet. Videos can still be saved—create a campaign later for reporting.
                <a
                  href="/campaigns/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Launch campaign builder
                </a>
              </div>
            ) : (
              <select
                id="campaign-select"
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                disabled={saving}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-100 disabled:opacity-50"
              >
                <option value="">Select a campaign…</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.title} ({campaign.items.length} videos)
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              {videos.filter((v) => videoMetadata[v.id]?.isComplete).length} of {videos.length} ready
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateCurrentMetadata({ isComplete: false })}
                disabled={saving || !currentMetadata.isComplete}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                Edit video
              </button>
              <button
                type="button"
                onClick={handleMarkComplete}
                disabled={saving || !currentMetadata.title.trim() || currentMetadata.isComplete}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:opacity-50"
              >
                Mark complete
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={saving || !allComplete}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(15,23,42,0.25)] transition hover:brightness-110 disabled:opacity-50"
              >
                {saving ? 'Saving…' : `Save all (${videos.length})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
