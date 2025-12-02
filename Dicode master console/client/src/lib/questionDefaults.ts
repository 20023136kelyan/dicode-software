import { QuestionFormData, QuestionType, QuestionRole } from './types';

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

const SCORE_SCALE = {
  scaleType: '7-point' as const,
  scaleLabels: {
    low: 'Strongly Disagree',
    high: 'Strongly Agree',
  },
};

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
    title: 'Q2 · Behavioral Intent/Application',
    description: 'Gauge the learner’s intent to apply the behavior in their own work.',
    helper: 'Fixed 7-point scale · Strongly Disagree → Strongly Agree',
    placeholder:
      'I am confident applying this coaching technique in my upcoming conversations.',
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
  if (type === 'qualitative') {
    return {
      role: getRoleForType(type),
      type,
      statement: '',
      isRequired: true,
    };
  }

  return {
    role: getRoleForType(type),
    type,
    statement: '',
    competency: '',
    competencyId: undefined,
    skillId: undefined,
    isRequired: true,
    ...buildQuantScale(),
  };
};

export const createDefaultQuestionSet = (): QuestionFormData[] =>
  QUESTION_SEQUENCE.map((type) => createDefaultQuestion(type));

export const withFixedQuestionSettings = (
  question: QuestionFormData,
): QuestionFormData => {
  if (question.type === 'qualitative') {
    return {
      role: getRoleForType('qualitative'),
      type: 'qualitative',
      statement: question.statement || '',
      isRequired: true,
    };
  }

  return {
    role: getRoleForType(question.type),
    type: question.type,
    statement: question.statement || '',
    competency: question.competency || '',
    competencyId: question.competencyId || undefined,
    skillId: question.skillId || undefined,
    isRequired: true,
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

