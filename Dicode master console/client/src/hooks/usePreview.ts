import { useCallback, useEffect, useRef, useState } from "react";
import { fetchVideoContent } from "@/services/soraApi";
import type { VideoItem } from "@/utils/video";

export interface PreviewState {
  previewUrl: string | null;
  previewingId: string | null;
  previewLoading: boolean;
  previewError: string | null;
  playPreview: (item: VideoItem) => Promise<void>;
  clearPreview: () => void;
  prefetchPreviews: (items: VideoItem[]) => Promise<void>;
}

const getCacheKey = (item: VideoItem): string => {
  if (item.id) {
    return item.id;
  }
  if (item.download_url && item.download_url.startsWith("data:")) {
    return item.download_url;
  }
  if (item.download_url) {
    return item.download_url;
  }
  // libraryDocumentId is a dynamic property from Record<string, unknown>
  const libraryDocId = item.libraryDocumentId;
  if (libraryDocId && typeof libraryDocId === "string") {
    return libraryDocId;
  }
  return "";
};

const usePreview = (): PreviewState => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, string>>({});
  const inFlightRef = useRef<Record<string, Promise<string | null> | null>>({});

  const revokeUrl = useCallback((key: string) => {
    const url = cacheRef.current[key];
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore revoke failures
    }
    delete cacheRef.current[key];
  }, []);

  useEffect(
    () => () => {
      Object.keys(cacheRef.current).forEach(revokeUrl);
    },
    [revokeUrl],
  );

  const fetchAndCache = useCallback(async (item: VideoItem): Promise<string> => {
    const cacheKey = getCacheKey(item);
    if (!cacheKey) {
      throw new Error("Missing preview identifier");
    }

    const tryDownloadUrl = async (): Promise<string | null> => {
      const downloadUrl = item.download_url;
      if (!downloadUrl) return null;
      if (downloadUrl.startsWith("data:")) {
        return downloadUrl;
      }
      try {
        const response = await fetch(downloadUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch download_url (status ${response.status})`);
        }
        const directBlob = await response.blob();
        return URL.createObjectURL(directBlob);
      } catch (error) {
        console.warn("Preview download_url fetch failed, falling back to API", error);
        return null;
      }
    };

    let objectUrl: string | null = await tryDownloadUrl();

    if (!objectUrl && item.id && !item.id.startsWith("seq_")) {
      try {
        const blob = await fetchVideoContent({ videoId: item.id });
        objectUrl = URL.createObjectURL(blob);
      } catch (error) {
        console.warn("Preview API fetch failed", error);
        objectUrl = null;
      }
    }

    if (!objectUrl && item.download_url?.startsWith("blob:")) {
      objectUrl = item.download_url;
    }

    if (!objectUrl) {
      throw new Error("Preview content unavailable");
    }

    const previous = cacheRef.current[cacheKey];
    if (previous && previous.startsWith("blob:")) {
      URL.revokeObjectURL(previous);
    }

    cacheRef.current[cacheKey] = objectUrl;
    return objectUrl;
  }, []);

  const ensureCached = useCallback(
    async (item: VideoItem): Promise<{ key: string; url: string | null }> => {
      const cacheKey = getCacheKey(item);
      if (!cacheKey) return { key: "", url: null };

      if (cacheRef.current[cacheKey]) {
        return { key: cacheKey, url: cacheRef.current[cacheKey] };
      }

      const existingPromise = inFlightRef.current[cacheKey];
      if (existingPromise) {
        try {
          const result = await existingPromise;
          return { key: cacheKey, url: result };
        } catch {
          return { key: cacheKey, url: null };
        }
      }

      const promise = fetchAndCache(item)
        .then((url) => url)
        .catch((error) => {
          revokeUrl(cacheKey);
          throw error;
        })
        .finally(() => {
          delete inFlightRef.current[cacheKey];
        });

      inFlightRef.current[cacheKey] = promise;

      try {
        const result = await promise;
        return { key: cacheKey, url: result };
      } catch {
        return { key: cacheKey, url: null };
      }
    },
    [fetchAndCache, revokeUrl],
  );

  const prefetchPreviews = useCallback(
    async (items: VideoItem[]) => {
      const uniqueKeys = Array.from(
        new Set(
          (items || [])
            .map((item) => getCacheKey(item))
            .filter((key): key is string => Boolean(key)),
        ),
      );
      const validKeys = new Set(uniqueKeys);

      Object.keys(cacheRef.current).forEach((key) => {
        if (!validKeys.has(key)) {
          revokeUrl(key);
        }
      });

      Object.keys(inFlightRef.current).forEach((key) => {
        if (!validKeys.has(key)) {
          delete inFlightRef.current[key];
        }
      });

      if (!items.length) return;
      await Promise.allSettled(items.map((item) => ensureCached(item)));
    },
    [ensureCached, revokeUrl],
  );

  const playPreview = useCallback(
    async (item: VideoItem) => {
      if (!item) return;
      const cacheKey = getCacheKey(item);
      if (!cacheKey) return;
      if (previewingId === cacheKey && previewUrl) return;

      if (cacheRef.current[cacheKey]) {
        setPreviewUrl(cacheRef.current[cacheKey]);
        setPreviewingId(cacheKey);
        setPreviewError(null);
        return;
      }

      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const result = await ensureCached(item);
        if (result.url) {
          setPreviewUrl(result.url);
          setPreviewingId(result.key);
        }
      } catch (error) {
        setPreviewError(
          error instanceof Error ? error.message : "Failed to load preview",
        );
      } finally {
        setPreviewLoading(false);
      }
    },
    [ensureCached, previewUrl, previewingId],
  );

  const clearPreview = useCallback(() => {
    setPreviewUrl(null);
    setPreviewingId(null);
    setPreviewLoading(false);
    setPreviewError(null);
  }, []);

  return {
    previewUrl,
    previewingId,
    previewLoading,
    previewError,
    playPreview,
    clearPreview,
    prefetchPreviews,
  };
};

export default usePreview;

