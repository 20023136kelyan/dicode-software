import { auth } from "@/lib/firebase";
import type { QuestionRole } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-x76kgbqadq-uc.a.run.app";
const normalizedApiBase = API_BASE.replace(/\/$/, "");
const questionToolsUrl = `${normalizedApiBase}${normalizedApiBase.endsWith("/api") ? "" : "/api"
  }/question-tools`;

type QuestionToolMode = "generate" | "validate";

export interface QuestionToolBaseParams {
  role: QuestionRole;
  competency?: string;
  skillName?: string;
  videoTitle?: string;
  scenarioDescription?: string;
}

export type GenerateQuestionParams = QuestionToolBaseParams;

export interface ValidateQuestionParams extends QuestionToolBaseParams {
  question: string;
}

export interface GenerateQuestionResponse {
  question: string;
  explanation?: string;
}

export interface ValidateQuestionResponse {
  isValid: boolean;
  issues: string[];
  severity: "ok" | "warning" | "error";
  suggestedRewrite: string | null;
}

type ApiErrorPayload = { error?: { message?: string } };

const readJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
};

const withAuthHeaders = async (headers: HeadersInit = {}) => {
  const user = auth.currentUser;
  if (!user) return headers;
  try {
    const token = await user.getIdToken();
    if (!token) return headers;
    return {
      ...headers,
      Authorization: `Bearer ${token}`,
    };
  } catch {
    return headers;
  }
};

const callQuestionTools = async <T>(
  mode: QuestionToolMode,
  body: object,
): Promise<T> => {
  const headers = await withAuthHeaders({ "Content-Type": "application/json" });
  const response = await fetch(questionToolsUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, mode }),
  });

  if (!response.ok) {
    const payload = await readJson<ApiErrorPayload>(response);
    const message = payload?.error?.message || response.statusText || "Request failed";
    throw new Error(message);
  }

  return readJson<T>(response);
};

export const generateQuestion = (params: GenerateQuestionParams) =>
  callQuestionTools<GenerateQuestionResponse>("generate", params);

export const validateQuestion = (params: ValidateQuestionParams) =>
  callQuestionTools<ValidateQuestionResponse>("validate", {
    ...params,
    currentQuestion: params.question,
  });

