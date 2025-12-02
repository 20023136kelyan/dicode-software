import type { Question, QuestionFormData } from './types';

/**
 * Generates a unique ID using crypto.randomUUID or fallback
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Converts QuestionFormData (from forms) to Question (for Firestore)
 * Generates a unique ID for each question
 */
export function convertFormDataToQuestion(formData: QuestionFormData): Question {
  const question: Question = {
    id: generateId(),
    type: formData.type,
    role: formData.role,
    statement: formData.statement,
    isRequired: formData.isRequired,
  };

  if (formData.scaleType) {
    question.scaleType = formData.scaleType;
  }

  if (formData.scaleLabels) {
    question.scaleLabels = formData.scaleLabels;
  }

  if (formData.competency) {
    question.competency = formData.competency;
  }

  if (formData.competencyId) {
    question.competencyId = formData.competencyId;
  }

  if (formData.skillId) {
    question.skillId = formData.skillId;
  }

  return question;
}

/**
 * Converts array of QuestionFormData to array of Questions
 */
export function convertFormDataToQuestions(formDataList: QuestionFormData[]): Question[] {
  return formDataList.map(convertFormDataToQuestion);
}
