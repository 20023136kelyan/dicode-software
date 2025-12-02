export const DEFAULT_SIZE = "1280x720" as const;

export const IMAGE_INPUT_ALERT =
  "This video was generated with a reference image. Add the same image before retrying, or clear the remix to proceed.";

export const MODEL_OPTIONS = ["sora-2", "sora-2-pro"] as const;
export type SoraModel = (typeof MODEL_OPTIONS)[number];

export type SizeOptionGroups = {
  portrait: readonly string[];
  landscape: readonly string[];
};

export const MODEL_SIZE_OPTIONS: Record<SoraModel, SizeOptionGroups> = {
  "sora-2": {
    portrait: ["720x1280"],
    landscape: [DEFAULT_SIZE],
  },
  "sora-2-pro": {
    portrait: ["720x1280", "1024x1792"],
    landscape: [DEFAULT_SIZE, "1792x1024"],
  },
};

export const SECONDS_OPTIONS = ["4", "8", "12"] as const;
export type SoraSeconds = (typeof SECONDS_OPTIONS)[number];

export const MAX_SHOT_COUNT = 3;

export type ShotConfig = {
  id: string;
  prompt: string;
  seconds: SoraSeconds;
  seed?: string | null;
  notes?: string | null;
};

export type ShotResult = {
  id: string;
  order: number;
  prompt: string;
  seconds: SoraSeconds;
  videoId: string;
  downloadUrl?: string | null;
  thumbnailUrl?: string | null;
  referenceFrameUrl?: string | null;
};

export type ShotSequenceResult = {
  sequenceId: string;
  model: SoraModel;
  size: string;
  totalSeconds: number;
  shots: ShotResult[];
  combinedDownloadUrl?: string | null;
};

export type ShotSequenceProgress = {
  current: number;
  total: number;
  shotId: string;
  videoId: string;
  status: VideoStatus;
};

export const buildSequenceId = (baseId: string) => `seq_${baseId}`;

type ShotResultSource = {
  id: string;
  prompt?: string | null;
  seconds?: SoraSeconds | string | number | null;
  download_url?: string | null;
  thumbnail_url?: string | null;
};

export const normalizeShotResult = (
  video: ShotResultSource,
  order: number,
  referenceFrameUrl: string | null = null,
): ShotResult => ({
  id: `${video.id}-shot-${order + 1}`,
  order,
  prompt: video.prompt ?? "",
  seconds: sanitizeSeconds(video.seconds ?? SECONDS_OPTIONS[0]),
  videoId: video.id,
  downloadUrl: video.download_url ?? null,
  thumbnailUrl: video.thumbnail_url ?? null,
  referenceFrameUrl,
});

export const sanitizeSeconds = (value: string | number | null | undefined): SoraSeconds => {
  const str = typeof value === "number" ? String(value) : (value ?? "").trim();
  return SECONDS_OPTIONS.includes(str as SoraSeconds) ? (str as SoraSeconds) : SECONDS_OPTIONS[0];
};

export type VideoStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "succeeded"
  | "failed"
  | string;

export interface VideoItem extends Record<string, unknown> {
  id: string;
  sequence_id?: string | null;
  status: VideoStatus;
  title: string;
  prompt?: string | null;
  model: SoraModel;
  size: string;
  seconds: SoraSeconds;
  shot_sequence?: ShotSequenceResult | null;
  remix_video_id: string | null;
  createdAt: string | null;
  completedAt: string | null;
  download_url?: string | null;
  thumbnail_url?: string | null;
  download_blob?: Blob;
  progress?: number | string | null;
  downloaded: boolean;
  image_input_required: boolean;
  error: unknown;
}

const coerceProgressPercent = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = value <= 1 ? value * 100 : value;
    return Math.max(0, Math.min(100, normalized));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed.replace(/%+$/, ""));
    if (!Number.isFinite(numeric)) return null;
    const normalized = numeric <= 1 ? numeric * 100 : numeric;
    return Math.max(0, Math.min(100, normalized));
  }
  return null;
};

export const sanitizeModel = (value: string): SoraModel =>
  MODEL_OPTIONS.includes(value as SoraModel) ? (value as SoraModel) : MODEL_OPTIONS[0];

export const getModelSizeOptions = (modelKey: string): SizeOptionGroups => {
  const key = sanitizeModel(modelKey);
  return MODEL_SIZE_OPTIONS[key] ?? MODEL_SIZE_OPTIONS[MODEL_OPTIONS[0]];
};

export const sanitizeSizeForModel = (sizeValue: string, modelKey: string): string => {
  const { portrait, landscape } = getModelSizeOptions(modelKey);
  const allowed = [...portrait, ...landscape];
  if (allowed.includes(sizeValue)) return sizeValue;
  return landscape[0] ?? portrait[0] ?? DEFAULT_SIZE;
};

const normalizeTimestamp = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
};

const toTimestampLike = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  if (value instanceof Date) return value;
  return null;
};

export const isCompletedStatus = (status: VideoStatus | null | undefined): boolean =>
  status === "completed" || status === "succeeded";

export const isFailedStatus = (status: VideoStatus | null | undefined): boolean =>
  status === "failed" || status === "cancelled" || status === "error";

export const normalizeVideo = (
  raw: Partial<VideoItem> | null | undefined,
  fallback: Partial<VideoItem> = {},
): VideoItem => {
  const source = (raw ?? {}) as Partial<VideoItem>;
  const fallbackSource = (fallback ?? {}) as Partial<VideoItem>;

  const status = (source.status ?? fallbackSource.status ?? "unknown") as VideoStatus;
  const title = (source.title || fallbackSource.title || source.name || "").toString().trim();
  const promptSource = (source.prompt ?? fallbackSource.prompt) as string | null | undefined;
  const prompt = typeof promptSource === "string" && promptSource.trim()
    ? promptSource.trim()
    : typeof fallbackSource.prompt === "string"
      ? fallbackSource.prompt
      : "";
  const totalSeconds =
    source.seconds ?? fallbackSource.seconds ?? SECONDS_OPTIONS[0];
  const model = sanitizeModel((source.model ?? fallbackSource.model ?? MODEL_OPTIONS[0]) as string);
  const size = sanitizeSizeForModel((source.size ?? fallbackSource.size ?? DEFAULT_SIZE) as string, model);
  const seconds = sanitizeSeconds(totalSeconds);
  const remix_video_id = (source.remix_video_id
    ?? source.remixVideoId
    ?? source.remix_of
    ?? source.remixOf
    ?? source.source_video_id
    ?? source.sourceVideoId
    ?? fallbackSource.remix_video_id
    ?? null) as string | null;
  const image_input_required = Boolean(source.image_input_required ?? fallbackSource.image_input_required ?? false);
  const downloaded = Boolean(source.downloaded ?? fallbackSource.downloaded ?? false);
  const error = source.error ?? fallbackSource.error ?? null;
  const download_url = typeof source.download_url === "string"
    ? source.download_url
    : typeof fallbackSource.download_url === "string"
      ? fallbackSource.download_url
      : null;
  let progress = coerceProgressPercent(source.progress ?? fallbackSource.progress ?? null);

  const completedAt =
    normalizeTimestamp(toTimestampLike(source.completed_at ?? source.completedAt))
    || normalizeTimestamp(toTimestampLike(fallbackSource.completed_at ?? fallbackSource.completedAt))
    || null;
  const createdAt =
    normalizeTimestamp(toTimestampLike(source.created_at ?? source.createdAt))
    || normalizeTimestamp(toTimestampLike(fallbackSource.created_at ?? fallbackSource.createdAt))
    || null;

  let finalCompletedAt = completedAt;
  let finalStatus = status;

  if (!finalCompletedAt && isCompletedStatus(status)) {
    finalCompletedAt = fallbackSource.completedAt ?? new Date().toISOString();
  }

  if (!isCompletedStatus(finalStatus)) {
    if (progress !== null && progress >= 100) {
      finalStatus = "completed";
    } else if (download_url) {
      finalStatus = "completed";
    }
  }

  if (isCompletedStatus(finalStatus) && !finalCompletedAt) {
    finalCompletedAt = new Date().toISOString();
  }

  if (isCompletedStatus(finalStatus) && (progress === null || progress < 100)) {
    progress = 100;
  }

  const sequence_id =
    typeof source.sequence_id === "string"
      ? source.sequence_id
      : typeof fallbackSource.sequence_id === "string"
        ? fallbackSource.sequence_id
        : null;
  const shot_sequence = (source.shot_sequence ??
    fallbackSource.shot_sequence ??
    null) as ShotSequenceResult | null;

  return {
    ...fallbackSource,
    ...source,
    id: String(source.id ?? fallbackSource.id ?? ""),
    sequence_id,
    status: finalStatus,
    title,
    prompt,
    model,
    size,
    seconds,
    shot_sequence,
    remix_video_id,
    createdAt,
    completedAt: finalCompletedAt,
    progress,
    download_url,
    downloaded,
    image_input_required,
    error,
  } satisfies VideoItem;
};

export const ensurePrompt = (
  item: Pick<VideoItem, "prompt" | "title"> | null | undefined,
  currentPrompt = "",
): string => {
  if (item?.prompt && item.prompt.trim()) return item.prompt;
  if (currentPrompt && currentPrompt.trim()) return currentPrompt;
  if (item?.title && item.title.trim()) return item.title.trim();
  return "Regenerate previous Sora video";
};

export const buildDownloadName = (id: string, title: string | null | undefined) => {
  const safe = (title || "")
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!safe) return `${id}.mp4`;
  const normalized = safe
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("-");
  return `${normalized.slice(0, 60) || id}.mp4`;
};

export const parseSize = (sizeStr: string) => {
  if (typeof sizeStr !== "string") return { width: 1280, height: 720 };
  const [wRaw, hRaw] = sizeStr.split("x");
  const w = Number(wRaw);
  const h = Number(hRaw);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { width: 1280, height: 720 };
  }
  return { width: w, height: h };
};

export const isWithinLast24Hours = (item: Partial<VideoItem> | null | undefined) => {
  if (!item) return false;
  const completedAt = item.completedAt ?? item.completed_at ?? null;
  const timestamp = completedAt ? Date.parse(String(completedAt)) : NaN;
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= 24 * 60 * 60 * 1000;
};

