'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { QuestionFormData } from '@/lib/types';
import { validateQuestion } from '@/lib/questionValidation';
import { QUESTION_META } from '@/lib/questionDefaults';
import { COMPETENCIES, type CompetencyDefinition, type SkillDefinition } from '@/lib/competencies';
import type { QuestionAssistantState } from '@/types/questionAssist';
import { Sparkles, ShieldCheck, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

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
}: QuestionEditorProps) {
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const validationErrors = validateQuestion(question);
    setErrors(validationErrors);
  }, [question]);

  const mergedCompetencies = useMemo<CompetencyDefinition[]>(() => {
    const base = competencyOptions && competencyOptions.length > 0 ? competencyOptions : COMPETENCIES;

    if (!question.competencyId) {
      return base;
    }

    const existsInBase = base.some((competency) => competency.id === question.competencyId);
    if (existsInBase) return base;

    const fallback = COMPETENCIES.find((competency) => competency.id === question.competencyId);
    if (fallback) {
      return [fallback, ...base];
    }

    return base;
  }, [competencyOptions, question.competencyId]);

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
              {isQuantitative && (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                  Likert scale
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
            <div className="border-t border-slate-100 grid md:grid-cols-2">
              <div className="p-3">
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
                  disabled={disabled}
                  className="w-full border-none bg-transparent text-sm text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-400"
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
              <div className="border-t border-slate-100 p-3 md:border-t-0 md:border-l">
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
                  disabled={disabled || !selectedCompetency || skillOptions.length === 0}
                  className="w-full border-none bg-transparent text-sm text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-400"
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
