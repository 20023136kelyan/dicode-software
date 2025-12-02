import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { fetchVideoContent } from "@/services/soraApi";
import type { VideoItem } from "@/utils/video";

type UseThumbnailsOptions = {
  items: VideoItem[];
};

type ThumbnailMap = Record<string, string>;
type InFlightMap = Record<string, Promise<void> | null | undefined>;

const useThumbnails = ({ items }: UseThumbnailsOptions): ThumbnailMap => {
  const [thumbnails, setThumbnails] = useState<ThumbnailMap>({});
  const inFlightRef = useRef<InFlightMap>({});
  const thumbnailsRef = useRef<ThumbnailMap>({});

  useEffect(() => {
    thumbnailsRef.current = thumbnails;
  }, [thumbnails]);

  useEffect(
    () => () => {
      Object.values(thumbnailsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    },
    [],
  );

  const loadThumbnail = useCallback(async (item: VideoItem): Promise<string | null> => {
    const directUrl = item.thumbnail_url;
    if (directUrl) {
      if (directUrl.startsWith("data:")) {
        return directUrl;
      }
      try {
        const response = await fetch(directUrl);
        if (!response.ok) throw new Error(`Thumbnail download failed (${response.status})`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      } catch (error) {
        console.warn("Thumbnail download_url fetch failed, falling back to API", error);
      }
    }

    if (item.id && !item.id.startsWith("seq_")) {
      try {
        const blob = await fetchVideoContent({ videoId: item.id, variant: "thumbnail" });
        return URL.createObjectURL(blob);
      } catch (error) {
        console.warn("Thumbnail API fetch failed", error);
      }
    }

    return null;
  }, []);

  useEffect(() => {
    if (!items.length) return;

    const keyedItems = items
      .map((item) => ({
        key: item.id || item.libraryDocumentId || "",
        item,
      }))
      .filter((entry): entry is { key: string; item: VideoItem } => Boolean(entry.key));

    const validKeys = new Set(keyedItems.map((entry) => entry.key));

    Object.keys(inFlightRef.current).forEach((key) => {
      if (!validKeys.has(key)) {
        delete inFlightRef.current[key];
      }
    });

    setThumbnails((prev) => {
      let changed = false;
      const next: ThumbnailMap = {};

      Object.entries(prev).forEach(([key, url]) => {
        const keep = validKeys.has(key);
        if (keep) {
          next[key] = url;
        } else {
          changed = true;
          if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
        }
      });

      return changed ? next : prev;
    });

    for (const { key, item } of keyedItems) {
      if (!key) continue;
      if (thumbnailsRef.current[key]) continue;
      if (inFlightRef.current[key]) continue;

      inFlightRef.current[key] = loadThumbnail(item)
        .then((url) => {
          if (!url) return;
          setThumbnails((prev) => {
            const previousUrl = prev[key];
            if (previousUrl && previousUrl.startsWith("blob:")) {
              URL.revokeObjectURL(previousUrl);
            }
            return { ...prev, [key]: url };
          });
        })
        .catch((error) => {
          console.warn("Thumbnail fetch failed", error);
        })
        .finally(() => {
          delete inFlightRef.current[key];
        });
    }
  }, [items, loadThumbnail]);

  return thumbnails;
};

export default useThumbnails;


