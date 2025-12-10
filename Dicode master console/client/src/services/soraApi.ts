import { auth } from "@/lib/firebase";
import type { GeneratedImageSuggestion } from "@/types/generated";
import type { ShotResult } from "@/utils/video";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-x76kgbqadq-uc.a.run.app";

const readJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) return {} as T;
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

const authorizedFetch = async (path: string, init?: RequestInit) => {
  const headers = await withAuthHeaders(init?.headers);
  // Ensure path has /api prefix for Cloud Functions routing
  const apiPath = path.startsWith('/api') ? path : `/api${path}`;
  return fetch(`${API_BASE}${apiPath}`, {
    ...init,
    headers,
  });
};

const ensureOk = async <T>(response: Response): Promise<void> => {
  if (response.ok) return;
  const payload = await readJson<T>(response);
  console.log('[SoraApi] Error Payload:', JSON.stringify(payload, null, 2));

  // Try to extract message with more robust checks (matching backend logic)
  let errorMessage = "Request failed";
  const anyError = payload as { error?: { message?: string; error?: { message?: string } }; message?: string };

  if (anyError?.error?.message) {
    errorMessage = anyError.error.message;
  } else if (anyError?.error?.error?.message) {
    // OpenAI nested error style
    errorMessage = anyError.error.error.message;
  } else if (anyError?.message) {
    errorMessage = anyError.message;
  } else if (response.statusText) {
    errorMessage = response.statusText;
  }

  const error = new Error(errorMessage) as Error & { status?: number; payload?: T };
  error.status = response.status;
  error.payload = payload;
  throw error;
};

export interface CreateVideoOptions {
  prompt: string;
  model: string;
  size: string;
  seconds: string | number;
  imageFile?: File | null;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const base64 = reader.result.split(",")[1] || reader.result;
        resolve(base64);
      } else if (reader.result instanceof ArrayBuffer) {
        const bytes = new Uint8Array(reader.result);
        let binary = "";
        bytes.forEach((b) => {
          binary += String.fromCharCode(b);
        });
        resolve(btoa(binary));
      } else {
        reject(new Error("Unsupported file format"));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

export const createVideo = async <T = unknown>({
  prompt,
  model,
  size,
  seconds,
  imageFile,
}: CreateVideoOptions): Promise<T> => {
  let imagePayload: Record<string, string> | null = null;
  if (imageFile) {
    const base64 = await fileToBase64(imageFile);
    imagePayload = {
      data: base64,
      mimeType: imageFile.type || "application/octet-stream",
      name: imageFile.name || "input-reference",
    };
  }

  const response = await authorizedFetch("/generate-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model, size, seconds, image: imagePayload }),
  });
  await ensureOk(response);
  return readJson<T>(response);
};

export interface RemixVideoOptions extends CreateVideoOptions {
  videoId: string;
}

export const remixVideo = async <T = unknown>({
  videoId,
  prompt,
  model,
  size,
  seconds,
}: RemixVideoOptions): Promise<T> => {
  const response = await authorizedFetch("/remix-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, prompt, model, size, seconds }),
  });
  await ensureOk(response);
  return readJson<T>(response);
};

export interface FetchVideoParams {
  videoId: string;
}

export const fetchVideo = async <T = unknown>({ videoId }: FetchVideoParams): Promise<T> => {
  const response = await authorizedFetch(`/videos/${encodeURIComponent(videoId)}`);
  await ensureOk(response);
  return readJson<T>(response);
};

export const fetchVideoBlob = async (videoId: string, variant: string = "video") => {
  const response = await authorizedFetch(
    `/videos/${encodeURIComponent(videoId)}/content?variant=${encodeURIComponent(variant)}`,
    {
      headers: { Accept: variant === "thumbnail" ? "image/png" : "video/mp4" },
    },
  );
  await ensureOk(response);
  return response.blob();
};

export interface FetchVideoContentParams {
  videoId: string;
  variant?: string;
}

export const fetchVideoContent = async ({
  videoId,
  variant = "video",
}: FetchVideoContentParams) => fetchVideoBlob(videoId, variant);

export interface GenerateImagesRequest {
  prompt: string;
  size?: string;
  count?: number;
  model?: string;
}

export const generateImages = async ({
  prompt,
  size,
  count,
  model,
}: GenerateImagesRequest): Promise<GeneratedImageSuggestion[]> => {
  const response = await authorizedFetch("/generate-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, size, count, model }),
  });
  await ensureOk(response);
  const payload = await readJson<{ images?: GeneratedImageSuggestion[] }>(response);
  return Array.isArray(payload.images) ? payload.images : [];
};

export const requestVideoTitle = async (prompt: string): Promise<string> => {
  const response = await authorizedFetch("/video-title", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  await ensureOk(response);
  const payload = await readJson<{ output?: unknown; output_text?: string[] }>(response);
  const text = Array.isArray(payload.output_text) ? payload.output_text.join(" ") : "";
  return text.trim();
};

export interface SuggestPromptRequest {
  prompt?: string;
  seconds?: string | number;
  model?: string;
  size?: string;
}

export const suggestVideoPrompt = async (
  params: SuggestPromptRequest,
): Promise<string> => {
  const response = await authorizedFetch("/suggest-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  await ensureOk(response);
  const payload = await readJson<{ prompt?: string }>(response);
  return typeof payload.prompt === "string" ? payload.prompt.trim() : "";
};

export interface SaveVideoRequest {
  videoId: string;
  title: string;
  description?: string;
  prompt: string;
  model: string;
  size: string;
  seconds: string | number;
  tags?: string[];
}

export const saveVideoToLibrary = async ({
  videoId,
  title,
  description,
  prompt,
  model,
  size,
  seconds,
  tags = [],
}: SaveVideoRequest) => {
  const response = await authorizedFetch(`/videos/${encodeURIComponent(videoId)}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      description,
      prompt,
      model,
      size,
      seconds,
      tags,
    }),
  });
  await ensureOk(response);
  return readJson<{ documentId: string; downloadUrl: string }>(response);
};

// Shot sequence generation has been removed in favor of the simpler approach:
// Generate individual videos and use the merge-videos endpoint to combine them

export interface ExtractFrameRequest {
  videoId: string;
}

export interface ExtractFrameResponse {
  frame: {
    data: string;
    mimeType: string;
    name: string;
  };
  videoId: string;
}

export const extractFrame = async ({
  videoId,
}: ExtractFrameRequest): Promise<ExtractFrameResponse> => {
  const response = await authorizedFetch("/extract-frame", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId }),
  });
  await ensureOk(response);
  return readJson<ExtractFrameResponse>(response);
};

export interface MergeVideosRequest {
  videoIds: string[];
}

export interface MergeVideosResponse {
  merged: {
    base64: string;
    mimeType: string;
  };
  videoIds: string[];
  count: number;
}

export const mergeVideos = async ({
  videoIds,
}: MergeVideosRequest): Promise<MergeVideosResponse> => {
  const response = await authorizedFetch("/merge-videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoIds }),
  });
  await ensureOk(response);
  return readJson<MergeVideosResponse>(response);
};

