import type { ValidateQuestionResponse } from "@/lib/questionTools";

export type QuestionAssistantState = {
  isGenerating?: boolean;
  isValidating?: boolean;
  issues?: string[];
  severity?: ValidateQuestionResponse['severity'];
  suggestedRewrite?: string | null;
  explanation?: string;
  error?: string | null;
  lastValidatedAt?: number;
};

