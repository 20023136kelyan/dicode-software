'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { X, CheckCircle2, Pencil, Globe, Building } from 'lucide-react';
import type { Video, QuestionFormData, Question, Organization } from '@/lib/types';
import QuestionBuilder from '@/components/Questions/QuestionBuilder';
import { validateQuestionSet } from '@/lib/questionValidation';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { updateVideo, logActivity, getAllOrganizations } from '@/lib/firestore';
import { buildTagList, type CompetencyDefinition } from '@/lib/competencies';
import { useCompetencies } from '@/hooks/useCompetencies';
import { normalizeQuestionSet } from '@/lib/questionDefaults';
import { generateQuestion, validateQuestion, type GenerateQuestionResponse, type ValidateQuestionResponse } from '@/lib/questionTools';
import type { QuestionAssistantState } from '@/types/questionAssist';

interface EditVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: Video | null;
  onSuccess: (updatedVideo: Video) => void;
}

// Convert Question[] to QuestionFormData[]
function questionsToFormData(questions: Question[] | undefined): QuestionFormData[] {
  if (!questions || questions.length === 0) {
    return normalizeQuestionSet([]);
  }

  return normalizeQuestionSet(
    questions.map((q) => ({
      role: q.role || (q.type === 'qualitative' ? 'qualitative' : q.type === 'behavioral-perception' ? 'perception' : 'intent'),
      type: q.type,
      statement: q.statement,
      scaleType: q.scaleType,
      scaleLabels: q.scaleLabels,
      benchmarkScore: q.benchmarkScore,
      options: q.options,
      competency: q.competency,
      competencyId: q.competencyId,
      skillId: q.skillId,
      isRequired: q.isRequired,
    }))
  );
}

// Convert QuestionFormData[] back to Question[]
// Only include fields that have actual values (Firebase rejects undefined)
function formDataToQuestions(formData: QuestionFormData[]): Question[] {
  return formData.map((q, index) => {
    const question: Record<string, unknown> = {
      id: `q${index + 1}`,
      type: q.type,
      role: q.role,
      statement: q.statement,
      isRequired: q.isRequired,
    };

    // Only include optional fields if they have values
    if (q.scaleType !== undefined) question.scaleType = q.scaleType;
    if (q.scaleLabels !== undefined) question.scaleLabels = q.scaleLabels;
    if (q.benchmarkScore !== undefined) question.benchmarkScore = q.benchmarkScore;
    if (q.options !== undefined) question.options = q.options;
    if (q.competency !== undefined) question.competency = q.competency;
    if (q.competencyId !== undefined) question.competencyId = q.competencyId;
    if (q.skillId !== undefined) question.skillId = q.skillId;

    return question as unknown as Question;
  });
}

export function EditVideoModal({
  isOpen,
  onClose,
  video,
  onSuccess,
}: EditVideoModalProps) {
  const { user } = useAuth();
  const { error: showError, success: showSuccess } = useNotification();
  const { competencies } = useCompetencies();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionFormData[]>([]);
  const [titleError, setTitleError] = useState('');
  const [saving, setSaving] = useState(false);
  const [questionAssistants, setQuestionAssistants] = useState<Record<number, QuestionAssistantState>>({});

  // Org state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [allowedOrganizations, setAllowedOrganizations] = useState<string[]>([]);

  // Load organizations
  useEffect(() => {
    if (isOpen) {
      getAllOrganizations()
        .then(setOrganizations)
        .catch(err => console.error('Failed to load organizations:', err));
    }
  }, [isOpen]);

  // Initialize form when video changes
  useEffect(() => {
    if (video && isOpen) {
      setTitle(video.title || '');
      setDescription(video.description || '');
      setQuestions(questionsToFormData(video.questions));
      setAllowedOrganizations(video.allowedOrganizations || []);
      setTitleError('');
      setQuestionAssistants({});
    }
  }, [video, isOpen]);

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

  const deriveCompetencyMeta = useCallback((qs: QuestionFormData[]) => {
    const competencyIds = new Set<string>();
    const skillsMap: Record<string, string[]> = {};

    qs.forEach((question) => {
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

  const currentSelections = useMemo(() => deriveCompetencyMeta(questions), [questions, deriveCompetencyMeta]);
  const selectedTags = useMemo(
    () => buildTagList(currentSelections.selectedCompetencies, currentSelections.selectedSkills),
    [currentSelections]
  );

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
        [index]: {
          ...prev[index],
          ...updates,
        },
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
    setQuestions((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], statement };
      }
      return next;
    });
  }, []);

  const handleGenerateQuestion = useCallback(
    async (questionIndex: number) => {
      const question = questions[questionIndex];
      if (!question) return;

      const state = questionAssistants[questionIndex];
      if (state?.isGenerating) return;

      updateQuestionAssistantState(questionIndex, {
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

        updateQuestionStatement(questionIndex, result.question.trim());
        updateQuestionAssistantState(questionIndex, {
          isGenerating: false,
          error: null,
          explanation: result.explanation,
          issues: [],
          severity: undefined,
          suggestedRewrite: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate question';
        updateQuestionAssistantState(questionIndex, {
          isGenerating: false,
          error: message,
        });
      }
    },
    [questions, questionAssistants, resolveQuestionContext, updateQuestionAssistantState, updateQuestionStatement, title, description]
  );

  const handleValidateQuestion = useCallback(
    async (questionIndex: number) => {
      const question = questions[questionIndex];
      if (!question) return;

      if (!question.statement.trim()) {
        updateQuestionAssistantState(questionIndex, {
          error: 'Enter a question before validating.',
        });
        return;
      }

      const state = questionAssistants[questionIndex];
      if (state?.isValidating) return;

      const now = Date.now();
      if (state?.lastValidatedAt && now - state.lastValidatedAt < 1500) {
        return;
      }

      updateQuestionAssistantState(questionIndex, {
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

        updateQuestionAssistantState(questionIndex, {
          isValidating: false,
          issues: result.issues,
          severity: result.severity,
          suggestedRewrite: result.suggestedRewrite,
          error: null,
          lastValidatedAt: Date.now(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to validate question';
        updateQuestionAssistantState(questionIndex, {
          isValidating: false,
          error: message,
        });
      }
    },
    [questions, questionAssistants, resolveQuestionContext, updateQuestionAssistantState]
  );

  const handleApplySuggestion = useCallback(
    (questionIndex: number) => {
      const suggestion = questionAssistants[questionIndex]?.suggestedRewrite;
      if (!suggestion) return;
      updateQuestionStatement(questionIndex, suggestion.trim());
      clearQuestionAssistantState([questionIndex]);
    },
    [questionAssistants, updateQuestionStatement, clearQuestionAssistantState]
  );

  const handleQuestionsChange = useCallback((newQuestions: QuestionFormData[]) => {
    // Clear assistant state for changed questions
    const changedIndices: number[] = [];
    newQuestions.forEach((q, i) => {
      const prev = questions[i];
      if (!prev || q.statement !== prev.statement || q.competencyId !== prev.competencyId || q.skillId !== prev.skillId) {
        changedIndices.push(i);
      }
    });

    setQuestions(newQuestions);

    if (changedIndices.length > 0) {
      clearQuestionAssistantState(changedIndices);
    }
  }, [questions, clearQuestionAssistantState]);

  const handleSave = useCallback(async () => {
    if (!video || !user) return;

    // Validate title
    if (!title.trim()) {
      setTitleError('Title is required');
      return;
    }
    if (title.trim().length > 200) {
      setTitleError('Title must be 200 characters or less');
      return;
    }
    setTitleError('');

    // Validate questions
    const questionErrors = validateQuestionSet(questions);
    if (questionErrors.length > 0) {
      showError('Validation Error', questionErrors[0]);
      return;
    }

    // Check competency/skill for behavioral questions
    const questionIssues: string[] = [];
    questions.forEach((question, index) => {
      if (question.type === 'behavioral-perception' || question.type === 'behavioral-intent') {
        if (!question.competencyId) {
          questionIssues.push(`Q${index + 1}: select a competency`);
        }
        if (!question.skillId) {
          questionIssues.push(`Q${index + 1}: select a skill`);
        }
      }
    });

    if (questionIssues.length > 0) {
      showError('Incomplete Questions', `Please complete the question metadata:\n${questionIssues.join('\n')}`);
      return;
    }

    setSaving(true);

    try {
      const selections = deriveCompetencyMeta(questions);
      const tags = buildTagList(selections.selectedCompetencies, selections.selectedSkills);

      const updatedQuestions = formDataToQuestions(questions);

      // Build update payload - only include description if it has a value
      const updatePayload: Record<string, unknown> = {
        title: title.trim(),
        questions: updatedQuestions,
        'metadata.tags': tags,
      };

      if (description.trim()) {
        updatePayload.description = description.trim();
      }

      await updateVideo(video.id, updatePayload as any);

      await logActivity({
        action: 'video_updated',
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || undefined,
        resourceId: video.id,
        resourceName: title.trim(),
        resourceType: 'video',
      });

      // Create updated video object
      const updatedVideo: Video = {
        ...video,
        title: title.trim(),
        description: description.trim() || undefined,
        questions: updatedQuestions,
        allowedOrganizations,
        metadata: {
          ...video.metadata,
          tags,
          updatedAt: new Date(),
        },
      };

      showSuccess('Video Updated', 'The video has been successfully updated.');
      onSuccess(updatedVideo);
      onClose();
    } catch (error) {
      console.error('Failed to update video:', error);
      showError('Update Failed', error instanceof Error ? error.message : 'Failed to update video');
    } finally {
      setSaving(false);
    }
  }, [video, user, title, description, questions, deriveCompetencyMeta, showError, showSuccess, onSuccess, onClose]);

  const handleCancel = useCallback(() => {
    if (!saving) {
      onClose();
    }
  }, [saving, onClose]);

  if (!isOpen || !video) return null;

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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <Pencil className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Edit Video</h2>
              <p className="text-sm text-slate-500">Update video details and questions</p>
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
          {/* Video Info */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Video ID</p>
              <p className="font-mono text-xs text-slate-600 mt-1">{video.id}</p>
              <p className="text-xs text-slate-500 mt-1">
                Source: <span className="font-medium text-slate-700">{video.source === 'generated' ? 'AI Generated' : 'Uploaded'}</span>
              </p>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a descriptive title"
              disabled={saving}
              maxLength={200}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 disabled:opacity-50 disabled:bg-slate-50"
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
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 disabled:opacity-50 disabled:bg-slate-50"
            />
            <p className="text-xs text-slate-400">{description.length}/1000 characters</p>
          </div>

          {/* Access Control */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700">Access Control</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAllowedOrganizations([])}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition ${allowedOrganizations.length === 0
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
                  if (allowedOrganizations.length === 0 && organizations.length > 0) {
                    setAllowedOrganizations([organizations[0].id]);
                  }
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition ${allowedOrganizations.length > 0
                  ? 'border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-500'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
              >
                <Building className="h-5 w-5" />
                <div className="text-xs font-medium">Specific Organization</div>
              </button>
            </div>

            {allowedOrganizations.length > 0 && (
              <div className="mt-3">
                <label className="mb-2 block text-xs font-medium text-slate-500">Select Organization</label>
                <select
                  value={allowedOrganizations[0] || ''}
                  onChange={(e) => setAllowedOrganizations([e.target.value])}
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
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 shrink-0 bg-slate-50">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default EditVideoModal;
