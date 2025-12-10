import { QuestionFormData, QuestionType, QuestionRole, IntentOption } from './types';

export const QUESTION_SEQUENCE: QuestionType[] = [
  'behavioral-perception',
  'behavioral-intent',
  'qualitative',
];

const QUESTION_ROLE_BY_TYPE: Record<QuestionType, QuestionRole> = {
  'behavioral-perception': 'perception',
  'behavioral-intent': 'intent',
  qualitative: 'qualitative',
};

const getRoleForType = (type: QuestionType): QuestionRole => QUESTION_ROLE_BY_TYPE[type];

// Q1 (behavioral-perception) uses Likert scale
const SCORE_SCALE = {
  scaleType: '7-point' as const,
  scaleLabels: {
    low: 'Strongly Disagree',
    high: 'Strongly Agree',
  },
};

/**
 * Create default SJT options for Q2 (behavioral-intent)
 * Each option has a text and a hidden intentScore (1-7)
 */
export const createDefaultIntentOptions = (): IntentOption[] => [
  { id: crypto.randomUUID(), text: '', intentScore: 7 },
  { id: crypto.randomUUID(), text: '', intentScore: 5 },
  { id: crypto.randomUUID(), text: '', intentScore: 3 },
  { id: crypto.randomUUID(), text: '', intentScore: 1 },
];

const buildQuantScale = () => ({
  scaleType: SCORE_SCALE.scaleType,
  scaleLabels: { ...SCORE_SCALE.scaleLabels },
});

export const QUESTION_META: Record<
  QuestionType,
  {
    title: string;
    description: string;
    helper?: string;
    placeholder: string;
    competencyLabel?: string;
    competencyHint?: string;
  }
> = {
  'behavioral-perception': {
    title: 'Q1 · Behavioral Perception',
    description: 'Capture how the learner perceives the behavior modeled in this video.',
    helper: 'Fixed 7-point scale · Strongly Disagree → Strongly Agree',
    placeholder:
      'The facilitator demonstrates active listening throughout the conversation.',
    competencyLabel: 'Competency tag',
    competencyHint: 'Which competency or behavior does this statement reinforce?',
  },
  'behavioral-intent': {
    title: 'Q2 · Situational Judgment',
    description: 'Present a scenario and multiple response options to gauge intent.',
    helper: 'Multiple choice · Each option has a hidden intent score (1-7)',
    placeholder:
      'After watching this video, what would you do if a team member pushed back on your feedback?',
    competencyLabel: 'Competency tag',
    competencyHint: 'Name the capability this question measures (e.g., Coaching).',
  },
  qualitative: {
    title: 'Q3 · Qualitative Insight',
    description: 'Invite a short written reflection for deeper context.',
    helper: 'Open-ended response · Encourage specificity.',
    placeholder: 'What would you do differently after watching this video?',
  },
};

export const createDefaultQuestion = (type: QuestionType): QuestionFormData => {
  // Q3 - Qualitative (free text)
  if (type === 'qualitative') {
    return {
      role: getRoleForType(type),
      type,
      statement: '',
      isRequired: true,
    };
  }

  // Q2 - Behavioral Intent (SJT multiple choice)
  if (type === 'behavioral-intent') {
    return {
      role: getRoleForType(type),
      type,
      statement: '',
      competency: '',
      competencyId: undefined,
      skillId: undefined,
      isRequired: true,
      options: createDefaultIntentOptions(),
    };
  }

  // Q1 - Behavioral Perception (Likert scale)
  return {
    role: getRoleForType(type),
    type,
    statement: '',
    competency: '',
    competencyId: undefined,
    skillId: undefined,
    isRequired: true,
    benchmarkScore: undefined, // Expert/control answer to be set by admin
    ...buildQuantScale(),
  };
};

export const createDefaultQuestionSet = (): QuestionFormData[] =>
  QUESTION_SEQUENCE.map((type) => createDefaultQuestion(type));

export const withFixedQuestionSettings = (
  question: QuestionFormData,
): QuestionFormData => {
  // Q3 - Qualitative
  if (question.type === 'qualitative') {
    return {
      role: getRoleForType('qualitative'),
      type: 'qualitative',
      statement: question.statement || '',
      isRequired: true,
    };
  }

  // Q2 - Behavioral Intent (SJT)
  if (question.type === 'behavioral-intent') {
    return {
      role: getRoleForType('behavioral-intent'),
      type: 'behavioral-intent',
      statement: question.statement || '',
      competency: question.competency || '',
      competencyId: question.competencyId || undefined,
      skillId: question.skillId || undefined,
      isRequired: true,
      // Preserve existing options or create defaults
      options: question.options?.length ? question.options : createDefaultIntentOptions(),
    };
  }

  // Q1 - Behavioral Perception (Likert)
  return {
    role: getRoleForType(question.type),
    type: question.type,
    statement: question.statement || '',
    competency: question.competency || '',
    competencyId: question.competencyId || undefined,
    skillId: question.skillId || undefined,
    isRequired: true,
    benchmarkScore: question.benchmarkScore, // Preserve benchmark score
    ...buildQuantScale(),
  };
};

export const normalizeQuestionSet = (
  questions?: QuestionFormData[],
): QuestionFormData[] => {
  const byType = new Map<QuestionType, QuestionFormData>();
  (questions || []).forEach((question) => {
    if (QUESTION_SEQUENCE.includes(question.type)) {
      byType.set(question.type, question);
    }
  });

  return QUESTION_SEQUENCE.map((type) => {
    const existing = byType.get(type);
    if (!existing) {
      return createDefaultQuestion(type);
    }

    return withFixedQuestionSettings({
      ...existing,
      type,
      role: getRoleForType(type),
    });
  });
};

