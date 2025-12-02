import OpenAI from "openai";

let openAiClient: OpenAI | null = null;

const getOpenAIBaseUrl = () =>
  (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );

const getAuthorizedHeaders = (init?: HeadersInit) => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const headers = new Headers(init ?? {});
  headers.set("Authorization", `Bearer ${apiKey}`);

  const organization = process.env.OPENAI_ORG_ID?.trim();
  if (organization && !headers.has("OpenAI-Organization")) {
    headers.set("OpenAI-Organization", organization);
  }

  const project = process.env.OPENAI_PROJECT_ID?.trim();
  if (project && !headers.has("OpenAI-Project")) {
    headers.set("OpenAI-Project", project);
  }

  return headers;
};

type OpenAIFetchOptions = RequestInit & {
  query?: Record<string, string | number | undefined>;
};

export const openAIFetch = async (
  path: string,
  { query, headers, ...options }: OpenAIFetchOptions = {},
) => {
  const base = getOpenAIBaseUrl().replace(/\/$/, "");
  const url =
    path.startsWith("http://") || path.startsWith("https://")
      ? new URL(path)
      : new URL(path.replace(/^\//, ""), `${base}/`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const authorizedHeaders = getAuthorizedHeaders(headers);

  return fetch(url.toString(), {
    ...options,
    headers: authorizedHeaders,
  });
};

export const getOpenAI = () => {
  if (openAiClient) return openAiClient;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  openAiClient = new OpenAI({
    apiKey,
    baseURL: getOpenAIBaseUrl(),
  });

  return openAiClient;
};

export type VideoVariant = "video" | "thumbnail" | "spritesheet";

export async function fetchVideoContent(
  videoId: string,
  variant: VideoVariant = "video",
) {
  const response = await openAIFetch(`/videos/${videoId}/content`, {
    method: "GET",
    headers: {
      Accept: "application/binary",
    },
    query: { variant },
  });

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType =
    response.headers.get("content-type") ||
    (variant === "thumbnail" ? "image/png" : "video/mp4");

  return {
    buffer,
    contentType,
  };
}

