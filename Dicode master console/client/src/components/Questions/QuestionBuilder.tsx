'use client';

import { useEffect, useMemo, useState } from 'react';
import { QuestionFormData, QuestionType } from '@/lib/types';
import QuestionEditor from './QuestionEditor';
import { validateQuestionSet } from '@/lib/questionValidation';
import {
  normalizeQuestionSet,
  QUESTION_SEQUENCE,
  withFixedQuestionSettings,
} from '@/lib/questionDefaults';
import { COMPETENCIES, type CompetencyDefinition } from '@/lib/competencies';
import type { QuestionAssistantState } from '@/types/questionAssist';

interface QuestionBuilderProps {
  questions: QuestionFormData[];
  onChange: (questions: QuestionFormData[]) => void;
  disabled?: boolean;
  competencyOptions?: CompetencyDefinition[];
  questionAssist?: {
    state: Record<number, QuestionAssistantState>;
    onGenerate?: (index: number) => void;
    onValidate?: (index: number) => void;
    onApplySuggestion?: (index: number) => void;
  };
}

export default function QuestionBuilder({
  questions,
  onChange,
  disabled = false,
  competencyOptions,
  questionAssist,
}: QuestionBuilderProps) {
  const orderedQuestions = useMemo(
    () => normalizeQuestionSet(questions),
    [questions],
  );

  const needsNormalization = useMemo(() => {
    if (!Array.isArray(questions) || questions.length !== QUESTION_SEQUENCE.length) {
      return true;
    }

    return QUESTION_SEQUENCE.some((type, index) => questions[index]?.type !== type);
  }, [questions]);

  useEffect(() => {
    if (needsNormalization) {
      onChange(orderedQuestions);
    }
  }, [needsNormalization, orderedQuestions, onChange]);

  const [setErrors, setSetErrors] = useState<string[]>([]);
  useEffect(() => {
    const validationErrors = validateQuestionSet(orderedQuestions);
    setSetErrors(validationErrors);
  }, [orderedQuestions]);

  const updateQuestion = (type: QuestionType, next: QuestionFormData) => {
    if (disabled) return;
    const fixedQuestion = withFixedQuestionSettings(next);
    const updated = orderedQuestions.map((question) =>
      question.type === type ? fixedQuestion : question,
    );
    onChange(updated);
  };

  const resolvedCompetencyOptions = useMemo<CompetencyDefinition[]>(() => {
    if (competencyOptions && competencyOptions.length > 0) {
      return competencyOptions;
    }
    return COMPETENCIES;
  }, [competencyOptions]);

  const assistStates = questionAssist?.state ?? {};
  const handleGenerate = questionAssist?.onGenerate;
  const handleValidate = questionAssist?.onValidate;
  const handleApplySuggestion = questionAssist?.onApplySuggestion;

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {orderedQuestions.map((question, index) => (
          <QuestionEditor
            key={question.type}
            question={question}
            questionNumber={index + 1}
            onChange={(updated) => updateQuestion(question.type, updated)}
            disabled={disabled}
            competencyOptions={resolvedCompetencyOptions}
            assistState={assistStates[index]}
            onGenerate={handleGenerate ? () => handleGenerate(index) : undefined}
            onValidate={handleValidate ? () => handleValidate(index) : undefined}
            onApplySuggestion={handleApplySuggestion ? () => handleApplySuggestion(index) : undefined}
          />
        ))}
          </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
        <div className="text-sm font-medium text-slate-600">
          {orderedQuestions.length} of 3 questions configured
        </div>
        {setErrors.length === 0 ? (
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Set matches DI Code framework
          </div>
        ) : (
          <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Fix question structure
          </div>
        )}
      </div>

      {setErrors.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold text-amber-900">Question set issues</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
            {setErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
