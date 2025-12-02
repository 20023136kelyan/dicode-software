'use client';

import { useEffect, useMemo, useState } from "react";
import {
  Timestamp,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeVideo, type VideoItem } from "@/utils/video";

type FirestoreVideoDoc = {
  title?: string;
  description?: string;
  storageUrl?: string;
  storagePath?: string;
  thumbnailUrl?: string;
  generationData?: {
    videoId?: string;
    prompt?: string;
    model?: string;
    size?: string;
    seconds?: string | number;
  };
  metadata?: {
    createdBy?: string;
    createdAt?: Timestamp | null;
    updatedAt?: Timestamp | null;
    tags?: string[];
  };
};

const timestampToIso = (value?: Timestamp | null) => {
  if (!value) return null;
  try {
    return value.toDate().toISOString();
  } catch {
    return null;
  }
};

const FALLBACK_SECONDS = "4";
const FALLBACK_MODEL = "sora-2";
const FALLBACK_SIZE = "1280x720";

export default function useVideoLibrary() {
  const { user } = useAuth();
  const [items, setItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return () => undefined;
    }

    setLoading(true);
    setError(null);

    const videosRef = collection(db, "videos");
    const userQuery = query(
      videosRef,
      orderBy("metadata.createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      userQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((doc) => {
          const data = doc.data() as FirestoreVideoDoc;
          const generation = data.generationData ?? {};
          const videoId =
            generation.videoId || generation.prompt || doc.id || crypto.randomUUID();
          const createdAtIso = timestampToIso(data.metadata?.createdAt ?? null);
          const updatedAtIso =
            timestampToIso(data.metadata?.updatedAt ?? null) ?? createdAtIso;

          const normalized = normalizeVideo({
            id: videoId,
            title: data.title ?? generation.prompt ?? "Untitled Video",
            prompt: generation.prompt ?? data.description ?? "",
            model: generation.model as any,
            size: generation.size as any,
            seconds: generation.seconds as any,
            download_url: data.storageUrl ?? null,
            thumbnail_url: data.thumbnailUrl ?? null,
            status: "completed",
            remix_video_id: generation.videoId ?? null,
            createdAt: createdAtIso,
            completedAt: updatedAtIso,
            downloaded: false,
            image_input_required: false,
          });

          return {
            ...normalized,
            libraryDocumentId: doc.id,
            storagePath: data.storagePath ?? null,
          } as VideoItem;
        });

        setItems(mapped);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load video library", err);
        setError(err instanceof Error ? err.message : "Failed to load video library");
        setItems([]);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  const result = useMemo(
    () => ({
      libraryItems: items,
      loading,
      error,
    }),
    [items, loading, error],
  );

  return result;
}


