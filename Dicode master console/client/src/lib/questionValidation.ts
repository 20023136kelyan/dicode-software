import { QuestionFormData } from './types';
import { QUESTION_SEQUENCE } from './questionDefaults';

// Words that indicate ambiguity (from DI Code framework)
const AMBIGUOUS_WORDS = [
  'sometimes',
  'often',
  'rarely',
  'occasionally',
  'frequently',
  'usually',
  'normally',
  'generally',
  'typically',
  'mostly',
  'somewhat',
  'kind of',
  'sort of',
  'maybe',
  'perhaps',
  'possibly',
  'probably',
];

// Words that might indicate double-barreled questions
const CONJUNCTION_WORDS = ['and', 'or', '&', 'plus'];

/**
 * Validate a question against DI Code framework rules
 */
export function validateQuestion(question: QuestionFormData): string[] {
  const errors: string[] = [];

  // Check for empty statement
  if (!question.statement.trim()) {
    errors.push('Question statement is required');
    return errors;
  }

  const statement = question.statement.toLowerCase();

  // Check for ambiguous words
  const foundAmbiguous = AMBIGUOUS_WORDS.filter((word) =>
    new RegExp(`\\b${word}\\b`, 'i').test(statement)
  );
  if (foundAmbiguous.length > 0) {
    errors.push(
      `Avoid ambiguous words: ${foundAmbiguous.join(', ')}. Use specific language.`
    );
  }

  // Check for double-barreled questions (contains 'and' or 'or' suggesting multiple concepts)
  const conjunctionCount = CONJUNCTION_WORDS.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = statement.match(regex);
    return count + (matches ? matches.length : 0);
  }, 0);

  if (conjunctionCount >= 2) {
    errors.push(
      'Question may be double-barreled (asking about multiple concepts). Focus on one concept at a time.'
    );
  }

  // Quantitative question validations
  if (
    question.type === 'behavioral-perception' ||
    question.type === 'behavioral-intent'
  ) {
    if (!question.scaleType) {
      errors.push('Scale type is required for quantitative questions');
    }

    if (!question.scaleLabels?.low || !question.scaleLabels?.high) {
      errors.push('Scale labels (low and high) are required for quantitative questions');
    }

    if (!question.competency) {
      errors.push('Competency tag is required for behavioral questions');
    }

    if (!question.competencyId) {
      errors.push('Select a competency from the library');
    }

    if (!question.skillId) {
      errors.push('Select a specific skill for this question');
    }

    // Check for question mark (behavioral questions should be statements)
    if (statement.includes('?')) {
      errors.push(
        'Behavioral questions should be statements, not questions. Remove the question mark.'
      );
    }
  }

  // Qualitative question validations
  if (question.type === 'qualitative') {
    // Qualitative should be open-ended, typically a question
    if (!statement.includes('?')) {
      errors.push('Qualitative questions should be phrased as questions (end with ?)');
    }
  }

  // Check minimum length
  if (question.statement.trim().length < 10) {
    errors.push('Question statement should be at least 10 characters long');
  }

  // Check maximum length
  if (question.statement.length > 200) {
    errors.push('Question statement should be less than 200 characters');
  }

  return errors;
}

/**
 * Validate a set of questions for a campaign item (enforcing 2+1 structure)
 */
export function validateQuestionSet(questions: QuestionFormData[]): string[] {
  const errors: string[] = [];

  if (!Array.isArray(questions) || questions.length !== QUESTION_SEQUENCE.length) {
    errors.push('All three DI Code questions (Q1, Q2, Q3) are required');
    return errors;
  }

  QUESTION_SEQUENCE.forEach((type, index) => {
    const question = questions[index];
    if (!question || question.type !== type) {
      errors.push(`Question ${index + 1} must be ${getQuestionTypeLabel(type)}`);
    }
  });

  return errors;
}

/**
 * Get question type display name
 */
export function getQuestionTypeLabel(type: QuestionFormData['type']): string {
  switch (type) {
    case 'behavioral-perception':
      return 'Q1: Behavioral Perception';
    case 'behavioral-intent':
      return 'Q2: Behavioral Intent/Application';
    case 'qualitative':
      return 'Q3: Qualitative Insight';
    default:
      return 'Unknown';
  }
}

/**
 * Get question type description
 */
export function getQuestionTypeDescription(type: QuestionFormData['type']): string {
  switch (type) {
    case 'behavioral-perception':
      return 'Measures how the learner perceives the behavior demonstrated in the video';
    case 'behavioral-intent':
      return 'Measures the learner\'s intent to apply the observed behavior';
    case 'qualitative':
      return 'Open-ended question for deeper insights and feedback';
    default:
      return '';
  }
}
