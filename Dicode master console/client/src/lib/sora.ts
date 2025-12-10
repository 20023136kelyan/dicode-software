import { z } from "zod";

const MODEL_OPTIONS = ["sora-2", "sora-2-pro"] as const;
const SIZE_OPTIONS = ["720x1280", "1280x720", "1024x1792", "1792x1024"] as const;
const SECONDS_OPTIONS = ["4", "8", "12"] as const;

export type VideoRequestPayload = {
  prompt: string;
  model: string;
  size: string;
  seconds: string;
};

const errorSchema = z.object({
  error: z
    .object({
      message: z.string().optional(),
      type: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),
});

const videoResponseSchema = z.object({
  id: z.string(),
  object: z.string().optional(),
  created_at: z.number().optional(),
  status: z.string(),
  completed_at: z.number().nullable().optional(),
  error: z.unknown().nullable().optional(),
  expires_at: z.number().nullable().optional(),
  model: z.string().optional(),
  progress: z.number().optional(),
  prompt: z.string().optional(),
  remixed_from_video_id: z.string().nullable().optional(),
  remix_video_id: z.string().nullable().optional(),
  seconds: z.union([z.string(), z.number()]).optional(),
  size: z.string().optional(),
  gcs_path: z.string().optional(),
  download_url: z.string().optional(),
  content_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  assets: z.unknown().optional(),
  output: z.unknown().optional(),
}).passthrough();

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const describeError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;

  if (isRecord(error)) {
    // Check for direct message
    if (typeof error.message === "string" && error.message) {
      return error.message;
    }

    // Check for { error: { message: ... } }
    if (typeof error.error === "object" && error.error !== null) {
      const err = error.error as { message?: string; error?: { message?: string } };
      if (err?.message) return err.message;

      // OpenAI nested error style: { error: { error: { message: ... } } }
      if (err?.error && typeof err.error === "object") {
        const nested = err.error as { message?: string };
        if (nested?.message) return nested.message;
      }
    }
  }

  return fallback;
};

export const resolveErrorStatus = (error: unknown) => {
  if (
    isRecord(error) &&
    typeof (error as { status?: number }).status === "number"
  ) {
    return (error as { status?: number }).status!;
  }
  return 500;
};

export const coerceVideoModel = (value: string | null) =>
  MODEL_OPTIONS.includes(value as (typeof MODEL_OPTIONS)[number])
    ? (value as (typeof MODEL_OPTIONS)[number])
    : "sora-2-pro";

export const coerceVideoSize = (value: string | null) =>
  SIZE_OPTIONS.includes(value as (typeof SIZE_OPTIONS)[number])
    ? (value as (typeof SIZE_OPTIONS)[number])
    : "720x1280";

export const coerceVideoSeconds = (value: string | null) =>
  SECONDS_OPTIONS.includes(value as (typeof SECONDS_OPTIONS)[number])
    ? (value as (typeof SECONDS_OPTIONS)[number])
    : "4";

const extractDownloadUrl = (data: z.infer<typeof videoResponseSchema>): string | null => {
  if (data.download_url) return data.download_url;
  if (data.content_url) return data.content_url;

  // Check nested assets
  if (isRecord(data.assets)) {
    if (isRecord(data.assets.video) && typeof data.assets.video.download_url === 'string') {
      return data.assets.video.download_url;
    }
    if (Array.isArray(data.assets)) {
      for (const asset of data.assets) {
        if (isRecord(asset) && typeof asset.download_url === 'string') {
          return asset.download_url;
        }
      }
    }
  }

  // Check output array
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (isRecord(item) && typeof item.download_url === 'string') {
        return item.download_url;
      }
    }
  }

  return null;
};

const extractThumbnailUrl = (data: z.infer<typeof videoResponseSchema>): string | null => {
  if (data.thumbnail_url) return data.thumbnail_url;

  // Check nested assets
  if (isRecord(data.assets)) {
    if (isRecord(data.assets.thumbnail) && typeof data.assets.thumbnail.url === 'string') {
      return data.assets.thumbnail.url;
    }
    if (Array.isArray(data.assets)) {
      for (const asset of data.assets) {
        if (isRecord(asset) && asset.type === 'thumbnail' && typeof asset.url === 'string') {
          return asset.url;
        }
      }
    }
  }

  return null;
};

export const normalizeVideoResponse = (
  response: unknown,
  fallback: VideoRequestPayload,
) => {
  const parsed = videoResponseSchema.safeParse(response);
  if (parsed.success) {
    const data = parsed.data;
    const now = Math.floor(Date.now() / 1000);

    return {
      ...data,
      id: data.id,
      status: data.status,
      prompt: data.prompt ?? fallback.prompt,
      model: data.model ?? fallback.model,
      size: data.size ?? fallback.size,
      seconds: String(data.seconds ?? fallback.seconds),
      created_at: data.created_at ?? now,
      completed_at: data.completed_at ?? (data.status === "completed" ? now : null),
      remix_video_id: data.remix_video_id ?? data.remixed_from_video_id ?? null,
      download_url: extractDownloadUrl(data),
      thumbnail_url: extractThumbnailUrl(data),
      progress: data.progress ?? 0,
      error: data.error ?? null,
    };
  }
  return {
    id: "",
    status: "unknown",
    prompt: fallback.prompt,
    model: fallback.model,
    size: fallback.size,
    seconds: fallback.seconds,
    error: { message: "Invalid response from OpenAI" },
  };
};

export const parseErrorPayload = (payload: unknown) => {
  const parsed = errorSchema.safeParse(payload);
  if (parsed.success) return parsed.data;
  return null;
};

