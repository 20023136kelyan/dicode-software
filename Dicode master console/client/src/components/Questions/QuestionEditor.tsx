'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { QuestionFormData, IntentOption } from '@/lib/types';
import { validateQuestion } from '@/lib/questionValidation';
import { QUESTION_META, createDefaultIntentOptions } from '@/lib/questionDefaults';
import { COMPETENCIES, type CompetencyDefinition, type SkillDefinition } from '@/lib/competencies';
import { useCompetencies } from '@/hooks/useCompetencies';
import type { QuestionAssistantState } from '@/types/questionAssist';
import { Sparkles, ShieldCheck, Loader2, AlertTriangle, CheckCircle2, Plus, Trash2, GripVertical } from 'lucide-react';

interface QuestionEditorProps {
  question: QuestionFormData;
  onChange: (question: QuestionFormData) => void;
  questionNumber: number;
  disabled?: boolean;
  competencyOptions?: CompetencyDefinition[];
  assistState?: QuestionAssistantState;
  onGenerate?: () => void;
  onValidate?: () => void;
  onApplySuggestion?: () => void;
  competencyLocked?: boolean; // When true, competency/skill inherit from Q1 and selectors are disabled
}

export default function QuestionEditor({
  question,
  onChange,
  questionNumber,
  disabled = false,
  competencyOptions,
  assistState,
  onGenerate,
  onValidate,
  onApplySuggestion,
  competencyLocked = false,
}: QuestionEditorProps) {
  const [errors, setErrors] = useState<string[]>([]);
  const { competencies: firestoreCompetencies } = useCompetencies();

  useEffect(() => {
    const validationErrors = validateQuestion(question);
    setErrors(validationErrors);
  }, [question]);

  const mergedCompetencies = useMemo<CompetencyDefinition[]>(() => {
    // Use provided options, then Firestore competencies, then static fallback
    const base = competencyOptions && competencyOptions.length > 0 
      ? competencyOptions 
      : (firestoreCompetencies.length > 0 ? firestoreCompetencies : COMPETENCIES);

    if (!question.competencyId) {
      return base;
    }

    const existsInBase = base.some((competency) => competency.id === question.competencyId);
    if (existsInBase) return base;

    // Try to find in Firestore competencies first, then static fallback
    const fallback = firestoreCompetencies.find((competency) => competency.id === question.competencyId)
      || COMPETENCIES.find((competency) => competency.id === question.competencyId);
    if (fallback) {
      return [fallback, ...base];
    }

    return base;
  }, [competencyOptions, firestoreCompetencies, question.competencyId]);

  const matchFromLegacy = useMemo(() => {
    if (!question.competency || question.skillId) return null;
    for (const competency of mergedCompetencies) {
      const skill = competency.skills.find((entry) => entry.name === question.competency);
      if (skill) {
        return { competency, skill };
      }
    }
    return null;
  }, [mergedCompetencies, question.competency, question.skillId]);

  useEffect(() => {
    if (matchFromLegacy) {
      onChange({
        ...question,
        competencyId: matchFromLegacy.competency.id,
        skillId: matchFromLegacy.skill.id,
        competency: matchFromLegacy.skill.name,
      });
    }
  }, [matchFromLegacy, onChange, question]);

  const selectedCompetency: CompetencyDefinition | undefined =
    mergedCompetencies.find((entry) => entry.id === question.competencyId) ||
    matchFromLegacy?.competency;

  const skillOptions: SkillDefinition[] = selectedCompetency?.skills || [];
  const selectedSkillId = question.skillId || matchFromLegacy?.skill.id || '';

  const meta = QUESTION_META[question.type];
  const isQuantitative =
    question.type === 'behavioral-perception' || question.type === 'behavioral-intent';
  const roleLabel =
    question.role === 'perception'
      ? 'Perception'
      : question.role === 'intent'
        ? 'Intent'
        : 'Qualitative';

  const handleBlur = useCallback(() => {
    if (!onValidate || disabled) return;
    if (!question.statement.trim()) return;
    if (assistState?.isValidating) return;
    const now = Date.now();
    if (assistState?.lastValidatedAt && now - assistState.lastValidatedAt < 1500) {
      return;
    }
    onValidate();
  }, [assistState?.isValidating, assistState?.lastValidatedAt, disabled, onValidate, question.statement]);

  const showAiSection = Boolean(onGenerate || onValidate);
  const showSuccess =
    assistState &&
    assistState.severity === 'ok' &&
    (assistState.issues?.length ?? 0) === 0 &&
    !assistState.isValidating &&
    !assistState.error;
  const showIssues = Boolean(assistState?.issues && assistState.issues.length > 0);

  return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
              Q{questionNumber}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
              {meta.title}
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                {roleLabel}
              </span>
              {question.type === 'behavioral-perception' && (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                  Likert scale
                </span>
              )}
              {question.type === 'behavioral-intent' && (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                  Multiple choice
                </span>
              )}
            </div>
          </div>
          <div className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
            Required
      </div>
        </div>

        <div className="space-y-3">
        <div className="rounded-[32px] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <textarea
            value={question.statement}
            onChange={(e) => onChange({ ...question, statement: e.target.value })}
            onBlur={handleBlur}
            placeholder={meta.description}
            maxLength={200}
            disabled={disabled}
            rows={3}
            className="w-full border-none bg-transparent px-5 py-3 text-sm text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-400 resize-none"
          />

        {isQuantitative && (
            <div className="border-t border-slate-100">
              {competencyLocked && (
                <div className="px-3 pt-2 pb-1">
                  <p className="text-[10px] text-slate-400 italic">
                    Skill inherited from Q1 (Perception)
                  </p>
                </div>
              )}
              <div className="grid md:grid-cols-2">
              <div className="p-3 pt-1">
              <select
                  aria-label="Select competency"
                  value={selectedCompetency?.id || ''}
                  onChange={(e) => {
                    const nextCompetency =
                      mergedCompetencies.find((entry) => entry.id === e.target.value) || null;
                    if (!nextCompetency) {
                      onChange({
                        ...question,
                        competencyId: undefined,
                        skillId: undefined,
                        competency: '',
                      });
                      return;
                    }
                    onChange({
                      ...question,
                      competencyId: nextCompetency.id,
                      skillId: undefined,
                      competency: '',
                    });
                  }}
                  disabled={disabled || competencyLocked}
                  className={`w-full border-none bg-transparent text-sm outline-none focus:ring-0 disabled:cursor-not-allowed ${
                    competencyLocked ? 'text-slate-500' : 'text-slate-900 disabled:text-slate-400'
                  }`}
                >
                  <option value="">
                    {mergedCompetencies.length === 0
                      ? 'Select competency'
                      : 'Select competency'}
                  </option>
                  {mergedCompetencies.map((competency) => (
                    <option key={competency.id} value={competency.id}>
                      {competency.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="border-t border-slate-100 p-3 pt-1 md:border-t-0 md:border-l">
                <select
                  aria-label="Select skill"
                  value={selectedSkillId}
                  onChange={(e) => {
                    if (!selectedCompetency) return;
                    const nextSkill =
                      selectedCompetency.skills.find((skill) => skill.id === e.target.value) ||
                      null;
                    onChange({
                      ...question,
                      competencyId: selectedCompetency.id,
                      skillId: nextSkill?.id,
                      competency: nextSkill?.name || '',
                    });
                  }}
                  disabled={disabled || competencyLocked || !selectedCompetency || skillOptions.length === 0}
                  className={`w-full border-none bg-transparent text-sm outline-none focus:ring-0 disabled:cursor-not-allowed ${
                    competencyLocked ? 'text-slate-500' : 'text-slate-900 disabled:text-slate-400'
                  }`}
                >
                  <option value="">
                    {!selectedCompetency
                      ? 'Select skill'
                      : skillOptions.length === 0
                        ? 'No skills available'
                        : 'Select skill'}
                  </option>
                  {skillOptions.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </select>
              </div>
              </div>
            </div>
          )}

          {/* Q1 Benchmark Score */}
          {question.type === 'behavioral-perception' && (
            <div className="border-t border-slate-100 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600">Expert Benchmark</p>
                  <p className="text-[11px] text-slate-400">
                    What would an expert answer? (1-7, used for comparison)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => onChange({ ...question, benchmarkScore: score })}
                      disabled={disabled}
                      className={`w-8 h-8 rounded-full text-xs font-semibold transition-all ${
                        question.benchmarkScore === score
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {score}
                    </button>
                  ))}
                  {question.benchmarkScore && (
                    <button
                      type="button"
                      onClick={() => onChange({ ...question, benchmarkScore: undefined })}
                      disabled={disabled}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Q2 Intent Options Editor */}
          {question.type === 'behavioral-intent' && (
            <div className="border-t border-slate-100 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600">Response Options</p>
                  <p className="text-[11px] text-slate-400">
                    Add choices with hidden intent scores (1=low, 7=high)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newOption: IntentOption = {
                      id: crypto.randomUUID(),
                      text: '',
                      intentScore: 4,
                    };
                    onChange({
                      ...question,
                      options: [...(question.options || []), newOption],
                    });
                  }}
                  disabled={disabled}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Option
                </button>
              </div>

              <div className="space-y-2">
                {(question.options || []).map((option, index) => (
                  <div
                    key={option.id}
                    className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2"
                  >
                    <GripVertical className="h-4 w-4 text-slate-300 flex-shrink-0" />
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => {
                        const newOptions = [...(question.options || [])];
                        newOptions[index] = { ...option, text: e.target.value };
                        onChange({ ...question, options: newOptions });
                      }}
                      placeholder={`Option ${index + 1} text...`}
                      disabled={disabled}
                      className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
                    />
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] text-slate-400">Score:</span>
                      <select
                        value={option.intentScore}
                        onChange={(e) => {
                          const newOptions = [...(question.options || [])];
                          newOptions[index] = { ...option, intentScore: parseInt(e.target.value) };
                          onChange({ ...question, options: newOptions });
                        }}
                        disabled={disabled}
                        className="w-12 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700 outline-none focus:border-blue-400"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newOptions = (question.options || []).filter((_, i) => i !== index);
                        onChange({ ...question, options: newOptions });
                      }}
                      disabled={disabled || (question.options?.length || 0) <= 2}
                      className="p-1 text-slate-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {(!question.options || question.options.length < 2) && (
                <p className="text-[11px] text-amber-600">
                  At least 2 options are required
                </p>
              )}
            </div>
          )}
            </div>
        <p className="text-xs text-slate-400">{question.statement.length}/200 characters</p>

        {showAiSection && (
          <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onGenerate}
                disabled={!onGenerate || disabled || assistState?.isGenerating}
                aria-label="Generate question with AI"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {assistState?.isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {assistState?.isGenerating ? 'Generating…' : 'Generate with AI'}
              </button>
              <button
                type="button"
                onClick={onValidate}
                disabled={!onValidate || disabled || assistState?.isValidating}
                aria-label="Validate question with AI"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {assistState?.isValidating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                {assistState?.isValidating ? 'Validating…' : 'Validate with AI'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              AI can help draft or validate questions, but you can always edit them.
            </p>
          </div>
        )}

        {assistState?.explanation && (
          <p className="text-[11px] italic text-slate-500">
            AI note: {assistState.explanation}
          </p>
        )}

        {assistState?.error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            {assistState.error}
          </div>
        )}

        {showSuccess && (
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            AI validator: Looks good
          </div>
        )}

        {showIssues && (
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />
              AI validator found issues:
            </div>
            <ul className="list-disc pl-5 space-y-1 text-amber-800">
              {assistState?.issues?.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
            {assistState?.suggestedRewrite && onApplySuggestion && (
              <button
                type="button"
                onClick={onApplySuggestion}
                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Replace with AI suggestion
              </button>
            )}
          </div>
        )}
          </div>

        {errors.length === 0 && question.statement.trim().length >= 10 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          Ready for review
          </div>
        )}
    </div>
  );
}
