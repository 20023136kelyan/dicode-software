/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Loader2, Menu, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Modal from "@/components/Layout/Modal";
import VideoForm, {
  type BatchProgressState,
  type GeneratedImageSuggestion,
} from "@/components/VideoForm";
import VideoSidebar, {
  type SidebarPreviewState,
} from "@/components/VideoSidebar";
import VideoPreviewOverlay from "@/components/VideoPreviewOverlay";
import { SaveToLibraryModal, type SaveMetadata } from "@/components/SaveToLibraryModal";
import usePersistedState from "@/hooks/usePersistedState";
import usePreview from "@/hooks/usePreview";
import useThumbnails from "@/hooks/useThumbnails";
import useVideoForm from "@/hooks/useVideoForm";
import useVideoPolling from "@/hooks/useVideoPolling";
import useVideoLibrary from "@/hooks/useVideoLibrary";
import { useAuth } from "@/contexts/AuthContext";
import { useNotification } from "@/contexts/NotificationContext";
import { incrementAssetsUsage, createVideo as createVideoInFirestore, createCampaignItem, getCampaign, getCampaignsByVideo, deleteVideo as deleteVideoDoc } from "@/lib/firestore";
import { uploadVideoBlob, generateVideoPath, deleteVideo as deleteVideoStorage } from "@/lib/storage";
import { convertFormDataToQuestions } from "@/lib/questionUtils";
import { extractThumbnail } from "@/lib/videoUtils";
import {
  IMAGE_INPUT_ALERT,
  MODEL_OPTIONS,
  buildDownloadName,
  ensurePrompt,
  isCompletedStatus,
  normalizeVideo,
  parseSize,
  sanitizeModel,
  sanitizeSizeForModel,
  type VideoItem,
  type SoraModel,
  type SoraSeconds,
} from "@/utils/video";
import { composePromptWithAssets } from "@/utils/assets";
import {
  createVideo,
  fetchVideo,
  fetchVideoContent,
  generateImages,
  remixVideo,
  requestVideoTitle,
  suggestVideoPrompt,
  extractFrame,
  mergeVideos,
} from "@/services/soraApi";

type CreateVideoOverrideOptions = {
  overridePrompt?: string;
  overrideModel?: SoraModel;
  overrideSize?: string;
  overrideSeconds?: SoraSeconds;
  overrideRemixId?: string | null;
  overrideTitle?: string;
  replaceId?: string;
};

type DownloadResult = boolean;

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const IMAGE_GENERATION_MODEL = "gpt-image-1";

const getPreviewKey = (item: VideoItem) =>
  item.download_url ||
  item.id ||
  (item as { libraryDocumentId?: string }).libraryDocumentId ||
  "";

const usePreviewState = () => {
  const preview = usePreview();
  const previewState: SidebarPreviewState = {
    previewingId: preview.previewingId,
    previewLoading: preview.previewLoading,
  };
  return { preview, previewState };
};

export default function App() {
  const [sessionItems, setSessionItems] = usePersistedState<VideoItem[]>(
    "sora.items",
    [],
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgressState | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [generatingTitle, setGeneratingTitle] = useState<boolean>(false);
  const [downloadingAll, setDownloadingAll] = useState<boolean>(false);
  const [generatingImages, setGeneratingImages] = useState<boolean>(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageSuggestion[]>([]);
  const [generatedImageError, setGeneratedImageError] = useState<string>("");
  const [selectedGeneratedImageId, setSelectedGeneratedImageId] = useState<
    string | null
  >(null);
  const [generatingPrompt, setGeneratingPrompt] = useState<boolean>(false);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [refreshingVideos, setRefreshingVideos] =
    useState<Record<string, boolean>>({});
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [mergingVideos, setMergingVideos] = useState<boolean>(false);
  const [mergedVideoBlob, setMergedVideoBlob] = useState<Blob | null>(null);
  const [savingToLibrary, setSavingToLibrary] = useState<boolean>(false);
  const [videosToSave, setVideosToSave] = useState<VideoItem[]>([]);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    video: VideoItem | null;
    campaigns: Array<{ title: string }> | null;
    isDeleting: boolean;
  }>({ isOpen: false, video: null, campaigns: null, isDeleting: false });
  const { libraryItems, loading: libraryLoading } = useVideoLibrary();
  const { user } = useAuth();
  const { success: showSuccess, error: showError, warning: showWarning, info: showInfo } = useNotification();

  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  const openMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(true);
  }, []);

  const {
    prompt,
    setPrompt,
    model,
    setModel,
    size,
    setSize,
    seconds,
    setSeconds,
    versionsCount,
    setVersionsCount,
    remixId,
    setRemixId,
    imageFile,
    imagePreviewUrl,
    imagePreviewMeta,
    handleImageSelect,
    handleGeneratedImageDataUrl,
    handleGeneratedImageUrl,
    clearForm: resetFormFields,
    applyVideoToForm,
    sizeOptionGroups,
    shotsEnabled,
    sharedSettingsLocked,
    shots,
    activeShotIndex,
    toggleShots,
    addShot,
    removeShot,
    duplicateShot,
    selectShot,
    activeAssets,
    addAssetToActivePrompt,
    removeAssetFromActivePrompt,
    assetsState,
    draftNoticeVisible,
    dismissDraftNotice,
    clearDraft,
  } = useVideoForm();

  const { preview, previewState } = usePreviewState();
  const { prefetchPreviews } = preview;

  const displayItems = useMemo(() => {
    const merged = [...libraryItems, ...sessionItems];
    const map = new Map<string, VideoItem>();

    merged.forEach((item) => {
      if (!item) return;
      const key =
        item.id ||
        (item as { libraryDocumentId?: string }).libraryDocumentId ||
        crypto.randomUUID();
      if (!map.has(key)) {
        map.set(key, item);
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const aTime = Date.parse(a.completedAt ?? a.createdAt ?? "") || 0;
      const bTime = Date.parse(b.completedAt ?? b.createdAt ?? "") || 0;
      return bTime - aTime;
    });
  }, [libraryItems, sessionItems]);

  const remoteThumbnailItems = useMemo(
    () => sessionItems.filter((item) => item.id && !item.thumbnail_url && isCompletedStatus(item.status)),
    [sessionItems],
  );

  const thumbnails = useThumbnails({ items: remoteThumbnailItems });

  const thumbnailMap = useMemo(() => {
    const map: Record<string, string> = { ...thumbnails };
    // Process both session and library items
    [...sessionItems, ...libraryItems].forEach((item) => {
      if (item.id && typeof item.thumbnail_url === "string" && !map[item.id]) {
        map[item.id] = item.thumbnail_url;
      }
    });
    return map;
  }, [thumbnails, sessionItems, libraryItems]);

  const previewableItems = useMemo(
    () =>
      displayItems.filter(
        (item) => (item.download_url || item.id) && isCompletedStatus(item.status),
      ),
    [displayItems],
  );

  useEffect(() => {
    if (!previewableItems.length) return;
    prefetchPreviews(previewableItems).catch((error) => {
      console.error("Preview prefetch failed", error);
    });
  }, [prefetchPreviews, previewableItems]);

  const currentPreviewIndex = useMemo(
    () =>
      previewableItems.findIndex(
        (item) => getPreviewKey(item) === preview.previewingId,
      ),
    [previewableItems, preview.previewingId],
  );
  const currentPreviewItem =
    currentPreviewIndex >= 0 ? previewableItems[currentPreviewIndex] : null;
  const hasPrevPreview = currentPreviewIndex > 0;
  const hasNextPreview =
    currentPreviewIndex >= 0 && currentPreviewIndex < previewableItems.length - 1;
  const showPreviewSpinner = preview.previewLoading && !preview.previewingId;
  const derivedPromptForImages = useMemo(() => prompt.trim(), [prompt]);
  const imageGenerationSize = useMemo(() => {
    const { width, height } = parseSize(size);
    return height > width ? "1024x1536" : "1536x1024";
  }, [size]);
  const handleUpdateItem = useCallback(
    (id: string, updater: (existing: VideoItem) => VideoItem) => {
      setSessionItems((prev) =>
        prev.map((existing) => (existing.id === id ? updater(existing) : existing)),
      );
    },
    [setSessionItems],
  );

  const handleRefreshVideo = useCallback(
    async (item: VideoItem) => {
      if (!item?.id) return;
      if ((item as { libraryDocumentId?: string }).libraryDocumentId) {
        console.log("Stored videos do not support refresh.");
        return;
      }
      if (refreshingVideos[item.id]) return;
      setRefreshingVideos((prev) => ({ ...prev, [item.id]: true }));
      try {
        const payload = await fetchVideo<Record<string, unknown>>({
          videoId: item.id,
        });
        handleUpdateItem(item.id, (current) => normalizeVideo(payload, current));
      } catch (error) {
        console.error("Video refresh failed", error);
      } finally {
        setRefreshingVideos((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }
    },
    [handleUpdateItem, refreshingVideos],
  );

  useVideoPolling({ items: sessionItems, onUpdate: handleUpdateItem });

  const requestGeneratedTitle = useCallback(async (seedPrompt: string) => {
    try {
      const response = await requestVideoTitle(seedPrompt || "Untitled");
      return response?.trim() ? response.trim().slice(0, 80) : "";
    } catch (error) {
      console.error("Title generation failed", error);
      return "";
    }
  }, []);

  const handleCreateVideo = useCallback(
    async (options: CreateVideoOverrideOptions = {}) => {
      const {
        overridePrompt,
        overrideModel,
        overrideSize,
        overrideSeconds,
        overrideRemixId,
        overrideTitle,
        replaceId,
      } = options;

      const usedAssetIds = new Set<string>();
      const shouldInjectAssets = !overridePrompt;
      const activeShot = shots[activeShotIndex];
      const resolveAssetsForShot = (shotId?: string | null) => {
        if (!shouldInjectAssets) {
          return [];
        }
        if (shotId) {
          return assetsState.shots[shotId] ?? [];
        }
        return assetsState.base ?? [];
      };

      const effectivePromptRaw = ensurePrompt(
        { prompt: overridePrompt, title: overrideTitle || "" },
        prompt,
      );
      const trimmedPrompt = effectivePromptRaw.trim();
      let submissionPrompt = trimmedPrompt;
      if (!trimmedPrompt) {
        setGeneratingTitle(false);
        setSubmitting(false);
        console.log(
          "Cannot generate without a prompt. Please provide one before retrying.",
        );
        return;
      }

      setCurrentTitle("");

      const fallbackTitle =
        trimmedPrompt.split("\n")[0].slice(0, 60) || "Untitled Video";
      const effectiveModel = sanitizeModel((overrideModel ?? model) as string);
      const effectiveSize = sanitizeSizeForModel(
        overrideSize ?? size,
        effectiveModel,
      );
      const effectiveSeconds = String(overrideSeconds ?? seconds);
      const effectiveRemixId = overrideRemixId ?? remixId;
      const runs = replaceId ? 1 : Math.max(1, Number(versionsCount) || 1);
      const isRemix = Boolean(effectiveRemixId);

      if (isRemix && imageFile) {
        console.log(
          "Remix currently ignores uploaded image overrides. Remove the image to continue, or create a fresh video instead.",
        );
        return;
      }

      setSubmitting(true);
      setBatchProgress(null);

      const multiShotActive = shotsEnabled && shots.length > 0;

      // Prepare video title for both single and multi-shot modes
      let videoTitle = overrideTitle?.trim() || "";
      if (!videoTitle) {
        videoTitle = fallbackTitle;
      }

      if (multiShotActive) {
        const shotPayloads = shots.map((shot, index) => {
          const basePrompt = (shot.prompt ?? "").trim();
          const shotAssets = resolveAssetsForShot(shot.id);
          const shotPrompt =
            shotAssets.length > 0 && basePrompt
              ? composePromptWithAssets(basePrompt, shotAssets)
              : basePrompt;
          if (shouldInjectAssets) {
            shotAssets.forEach((asset) => usedAssetIds.add(asset.id));
          }
          return {
            id: shot.id || `shot-${index + 1}`,
            prompt: shotPrompt,
            seconds: shot.seconds,
          };
        });

        if (shotPayloads.some((shot) => !shot.prompt)) {
          console.log("Each shot needs its own prompt before generating.");
          setSubmitting(false);
          return;
        }

        try {
          setBatchProgress({
            total: shotPayloads.length,
            current: 1,
            mode: "shots",
          });

          // Generate each shot as an individual video
          // Users can then select and merge them using the new merge feature
          showInfo(
            "Multi-Shot Generation",
            "Each shot will be generated as a separate video. You can then select the videos and click 'Merge' to combine them."
          );

          // For now, just generate the first shot as a regular video
          // The user will need to manually add subsequent shots using "Add Shot" button
          if (shotPayloads.length > 0) {
            const firstShot = shotPayloads[0];
            // Update the form with the first shot's prompt
            setPrompt(firstShot.prompt);
            setSeconds(firstShot.seconds);
            // Clear multi-shot mode
            // Let it fall through to normal video generation
            // But we need to turn off multi-shot mode in state for this run
          }

        } catch (error) {
          console.error(error);
          const message = error instanceof Error ? error.message : "Failed to generate shots";
          showError("Shot Generation Failed", message);
        } finally {
          setSubmitting(false);
          setBatchProgress(null);
        }
        return;
      }

      if (shouldInjectAssets) {
        const assetsForPrompt = resolveAssetsForShot(
          shotsEnabled && activeShot ? activeShot.id : undefined,
        );
        if (assetsForPrompt.length) {
          submissionPrompt = composePromptWithAssets(trimmedPrompt, assetsForPrompt);
          assetsForPrompt.forEach((asset) => usedAssetIds.add(asset.id));
        }
      }

      // Generate title for single video if needed
      if (!videoTitle) {
        setGeneratingTitle(true);
        const generated = await requestGeneratedTitle(trimmedPrompt);
        if (generated) {
          videoTitle = generated;
        }
        setGeneratingTitle(false);
      }
      setCurrentTitle(videoTitle);

      try {
        for (let runIndex = 0; runIndex < runs; runIndex += 1) {
          if (runs > 1) {
            setBatchProgress({
              total: runs,
              current: runIndex + 1,
              mode: "versions",
            });
          }

          let payload: Record<string, unknown>;
          if (isRemix) {
            payload = await remixVideo<Record<string, unknown>>({
              videoId: effectiveRemixId as string,
              prompt: submissionPrompt,
              model: effectiveModel,
              size: effectiveSize,
              seconds: effectiveSeconds,
            });
          } else {
            payload = await createVideo<Record<string, unknown>>({
              prompt: submissionPrompt,
              model: effectiveModel,
              size: effectiveSize,
              seconds: effectiveSeconds,
              imageFile,
            });
          }

          const rawItem: Record<string, unknown> = {
            ...payload,
            prompt: submissionPrompt,
            model: effectiveModel,
            size: effectiveSize,
            seconds: String(effectiveSeconds),
            remix_video_id:
              effectiveRemixId ||
              payload.remix_video_id ||
              payload.remixVideoId ||
              payload.remix_of ||
              payload.source_video_id ||
              null,
            image_input_required: Boolean(imageFile),
            error: payload.error ?? null,
            createdAt: new Date().toISOString(),
            created_at:
              (payload.created_at as number | undefined) ??
              (payload.createdAt as number | undefined) ??
              Date.now() / 1000,
            retry_of: replaceId || null,
            title: videoTitle,
          };

          const normalized = normalizeVideo(rawItem);

          setSessionItems((prev) => {
            if (replaceId && runIndex === 0) {
              let updated = false;
              const mapped = prev.map((existing) => {
                if (existing.id === replaceId) {
                  updated = true;
                  return normalizeVideo(rawItem, existing);
                }
                return existing;
              });
              return updated ? mapped : [normalized, ...prev];
            }
            return [normalized, ...prev];
          });

          if (runs > 1 && runIndex < runs - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        if (usedAssetIds.size > 0) {
          try {
            await incrementAssetsUsage(Array.from(usedAssetIds));
          } catch (error) {
            console.error("Failed to update asset usage", error);
          }
        }

        setRemixId("");
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to create video";
        showError("Video Generation Failed", message);
      } finally {
        setSubmitting(false);
        setBatchProgress(null);
      }
    },
    [
      activeShotIndex,
      assetsState,
      imageFile,
      model,
      prompt,
      remixId,
      requestGeneratedTitle,
      seconds,
      setSessionItems,
      setCurrentTitle,
      setRemixId,
      setPrompt,
      setSeconds,
      size,
      versionsCount,
      shotsEnabled,
      shots,
    ],
  );

  const handleDownload = useCallback(
    async (item: VideoItem): Promise<DownloadResult> => {
      try {
        let blob: Blob;
        if (item.download_url) {
          const response = await fetch(item.download_url);
          if (!response.ok) {
            throw new Error("Failed to download stored video");
          }
          blob = await response.blob();
        } else if (item.download_blob) {
          // Used for merged videos
          blob = item.download_blob;
        } else {
          blob = await fetchVideoContent({ videoId: item.id });
        }
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = buildDownloadName(item.id, item.title);
        anchor.click();
        URL.revokeObjectURL(url);
        setSessionItems((prev) =>
          prev.map((existing) =>
            existing.id === item.id ? { ...existing, downloaded: true } : existing,
          ),
        );
        return true;
      } catch (error) {
        console.error(
          `Download failed: ${error instanceof Error ? error.message : String(error)
          }`,
        );
        return false;
      }
    },
    [setSessionItems],
  );

  const handleDownloadAll = useCallback(async () => {
    const ready = sessionItems.filter(
      (item) =>
        (item.download_url || item.id) && isCompletedStatus(item.status) && !item.downloaded,
    );
    if (ready.length === 0) {
      console.log("No completed videos are available for download yet.");
      return;
    }
    setDownloadingAll(true);
    try {
      for (let index = 0; index < ready.length; index += 1) {
        const entry = ready[index];
        await handleDownload(entry);
        if (index < ready.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    } finally {
      setDownloadingAll(false);
    }
  }, [handleDownload, sessionItems]);

  const handlePlayPreview = useCallback(
    async (item: VideoItem) => {
      try {
        closeMobileSidebar();
        await preview.playPreview(item);
      } catch (error) {
        console.error(
          `Preview failed: ${error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
    [closeMobileSidebar, preview],
  );

  const handlePreviewClose = useCallback(() => {
    preview.clearPreview();
  }, [preview]);

  const handlePreviewNavigate = useCallback(
    (direction: number) => {
      if (currentPreviewIndex < 0) return;
      const targetIndex = currentPreviewIndex + direction;
      if (targetIndex < 0 || targetIndex >= previewableItems.length) return;
      const targetItem = previewableItems[targetIndex];
      if (!targetItem?.id) return;
      preview.playPreview(targetItem).catch((error) => {
        console.error(
          `Preview failed: ${error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    },
    [currentPreviewIndex, preview, previewableItems],
  );

  const handleResetForm = useCallback(() => {
    resetFormFields();
    setCurrentTitle("");
    preview.clearPreview();
    setGeneratedImages([]);
    setGeneratedImageError("");
    setSelectedGeneratedImageId(null);
  }, [preview, resetFormFields, setCurrentTitle]);

  const handleRemixFrom = useCallback(
    (item: VideoItem) => {
      if (!item?.id) return;
      const nextPrompt = ensurePrompt(item, prompt);
      applyVideoToForm(item, nextPrompt);
      setRemixId(item.id);
      setCurrentTitle(item.title || "");
      preview.clearPreview();
      scrollToTop();
      closeMobileSidebar();
    },
    [
      applyVideoToForm,
      closeMobileSidebar,
      preview,
      prompt,
      setCurrentTitle,
      setRemixId,
    ],
  );

  const handleAddShot = useCallback(
    async (item: VideoItem) => {
      if (!item?.id) return;
      try {
        // Extract the last frame from this video
        const result = await extractFrame({ videoId: item.id });

        // Convert the base64 frame to a File object
        const frameData = result.frame.data;
        const byteString = atob(frameData);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: "image/png" });
        const file = new File([blob], result.frame.name, { type: "image/png" });

        // Apply video settings to form and set the reference image
        applyVideoToForm(item, "");
        handleImageSelect({ target: { files: [file] } } as any);
        setCurrentTitle("");
        preview.clearPreview();
        scrollToTop();
        closeMobileSidebar();
      } catch (error) {
        console.error("Failed to extract frame:", error);
        showError("Frame Extraction Failed", "Failed to extract frame from video. Please try again.");
      }
    },
    [applyVideoToForm, handleImageSelect, preview, closeMobileSidebar, showError],
  );

  const handleToggleSelection = useCallback((videoId: string) => {
    setSelectedVideoIds((prev) =>
      prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : [...prev, videoId],
    );
  }, []);

  const handleMergeSelected = useCallback(
    async (videoIds: string[]) => {
      if (videoIds.length < 2) {
        showWarning("Selection Required", "Please select at least 2 videos to merge.");
        return;
      }

      setMergingVideos(true);
      try {
        // Find the first video to inherit its thumbnail
        const firstVideo = sessionItems.find(i => i.id === videoIds[0]);
        const inheritedThumbnail = firstVideo?.thumbnail_url || thumbnailMap[videoIds[0]];

        const result = await mergeVideos({ videoIds });

        // Convert base64 to blob
        const byteString = atob(result.merged.base64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: "video/mp4" });

        // Create a URL for the blob to preview immediately
        const mergedUrl = URL.createObjectURL(blob);

        // Store the merged video blob for download
        setMergedVideoBlob(blob);

        // Create a proper VideoItem for the merged result
        const mergedId = `merged_${Date.now()}`;
        const mergedItem: VideoItem & { download_blob?: Blob } = {
          id: mergedId,
          // Use the inherited thumbnail if available
          thumbnail_url: inheritedThumbnail || undefined,
          status: "completed",
          created_at: Date.now() / 1000,
          prompt: `Merged video from ${videoIds.length} clips`,
          model: firstVideo?.model || sanitizeModel(model),
          size: firstVideo?.size || size || "1920x1080",
          seconds: firstVideo?.seconds || seconds,
          title: `Merged Video (${videoIds.length} clips)`,
          download_url: mergedUrl, // Use object URL for immediate preview/download
          download_blob: blob, // Store blob for saving
          remix_video_id: null,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          downloaded: false,
          image_input_required: false,
          error: null,
        };

        // Add to session items so it appears in sidebar
        setSessionItems(prev => [mergedItem, ...prev]);

        // Clear selection
        setSelectedVideoIds([]);

        showSuccess("Videos Merged", `Successfully merged ${videoIds.length} videos! The merged video has been added to your session list.`);
      } catch (error) {
        console.error("Failed to merge videos:", error);
        showError("Merge Failed", "Failed to merge videos. Please try again.");
      } finally {
        setMergingVideos(false);
      }
    },
    [sessionItems, thumbnailMap, setSessionItems, model, size, seconds, showSuccess, showError],
  );

  const handleSaveSelected = useCallback(
    (videoIds: string[]) => {
      // Get valid videos (completed status only)
      const validVideos = videoIds
        .map((id) => sessionItems.find((item) => item.id === id))
        .filter((item) => item && isCompletedStatus(item.status)) as VideoItem[];

      if (validVideos.length === 0) {
        showWarning("Selection Required", "Please select completed videos to save.");
        return;
      }

      // Open modal with all videos to configure
      setVideosToSave(validVideos);
      setShowSaveModal(true);
    },
    [sessionItems, showWarning],
  );

  const fetchThumbnailBlob = useCallback(
    async (url: string): Promise<{ blob: Blob; contentType?: string }> => {
      if (!url) {
        throw new Error("Thumbnail URL missing");
      }

      if (/^https?:\/\//i.test(url)) {
        const response = await fetch("/api/proxy-thumbnail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!response.ok) {
          throw new Error(`Proxy thumbnail fetch failed (${response.status})`);
        }

        const proxyBlob = await response.blob();
        const proxyContentType =
          response.headers.get("content-type") || proxyBlob.type || undefined;

        return { blob: proxyBlob, contentType: proxyContentType };
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch thumbnail (${response.status})`);
      }

      const blob = await response.blob();
      return {
        blob,
        contentType: blob.type || response.headers.get("content-type") || undefined,
      };
    },
    [],
  );

  const handleSaveAllToLibrary = useCallback(
    async (metadataList: SaveMetadata[]) => {
      if (!user) {
        showError("Authentication Required", "You must be logged in to save videos.");
        return;
      }

      if (metadataList.length !== videosToSave.length) {
        showError("Data Mismatch", "Metadata count doesn't match videos. Please try again.");
        return;
      }

      setSavingToLibrary(true);
      try {
        const savedVideos: string[] = [];

        // Process each video with its metadata
        for (let i = 0; i < videosToSave.length; i++) {
          const video = videosToSave[i];
          const metadata = metadataList[i];

          try {
            // 1. Download video blob
            let blob: Blob;
            // Check if we have a direct blob (e.g. merged video)
            if ((video as any).download_blob) {
              blob = (video as any).download_blob;
            } else if (video.download_url) {
              // If it's a blob URL (local), fetch it
              if (video.download_url.startsWith('blob:')) {
                const response = await fetch(video.download_url);
                blob = await response.blob();
              } else {
                // External URL
                const response = await fetch(video.download_url);
                if (!response.ok) {
                  throw new Error("Failed to download stored video");
                }
                blob = await response.blob();
              }
            } else {
              blob = await fetchVideoContent({ videoId: video.id });
            }

            // 2. Upload to Firebase Storage
            const storagePath = generateVideoPath(
              user.uid,
              `${metadata.title.replace(/[^a-zA-Z0-9-_]/g, '_')}_${Date.now()}.mp4`
            );
            const storageUrl = await uploadVideoBlob(blob, storagePath, {
              contentType: blob.type || "video/mp4",
            });

            // 2b. Extract and upload thumbnail
            let thumbnailUrl: string | undefined;

            // Try to use existing thumbnail from OpenAI if available (or from map)
            const existingThumbUrl = video.thumbnail_url || thumbnailMap[video.id];

            if (existingThumbUrl) {
              try {
                const { blob: remoteThumbBlob, contentType } = await fetchThumbnailBlob(existingThumbUrl);
                const thumbnailPath = generateVideoPath(
                  user.uid,
                  `thumb_${metadata.title.replace(/[^a-zA-Z0-9-_]/g, '_')}_${Date.now()}.jpg`
                );
                thumbnailUrl = await uploadVideoBlob(remoteThumbBlob, thumbnailPath, {
                  contentType: contentType || remoteThumbBlob.type || "image/jpeg",
                });
                console.log('✅ Thumbnail fetched via proxy and uploaded:', thumbnailUrl);
              } catch (e) {
                console.warn("Failed to fetch/upload remote thumbnail, falling back to extraction", e);
              }
            }

            // Fallback to local extraction if we didn't get a thumbnail yet
            if (!thumbnailUrl) {
              try {
                const thumbnailBlob = await extractThumbnail(blob);
                const thumbnailPath = generateVideoPath(
                  user.uid,
                  `thumb_${metadata.title.replace(/[^a-zA-Z0-9-_]/g, '_')}_${Date.now()}.jpg`
                );
                thumbnailUrl = await uploadVideoBlob(thumbnailBlob, thumbnailPath, {
                  contentType: thumbnailBlob.type || "image/jpeg",
                });
                console.log('✅ Thumbnail extracted and uploaded:', thumbnailUrl);
              } catch (thumbError) {
                console.error('⚠️ Failed to generate thumbnail (continuing without it):', thumbError);
                // Continue without thumbnail - it's not critical
              }
            }

            // 3. Save to Firestore videos collection with questions
            const questions = metadata.questions && metadata.questions.length > 0
              ? convertFormDataToQuestions(metadata.questions)
              : undefined;

            // Build generationData only with defined values
            const generationData: any = {};
            if (video.quality) generationData.quality = video.quality;
            if (video.model) generationData.model = video.model;
            
            // Track used assets if available
            const usedAssetIds = metadata.usedAssetIds || [];
            if (usedAssetIds.length > 0) {
              generationData.usedAssets = usedAssetIds;
              // Increment usage count for all used assets
              await incrementAssetsUsage(usedAssetIds, { incrementBy: 1 });
            }

            const videoId = await createVideoInFirestore(user.uid, {
              title: metadata.title,
              description: metadata.description,
              storageUrl,
              thumbnailUrl, // Add thumbnail URL
              source: 'generated' as const,
              questions, // Questions now stored on video, not campaign item
              generationData: Object.keys(generationData).length > 0 ? generationData : undefined,
              tags: metadata.tags,
            });

            // 4. If campaign selected, add video to campaign (no questions needed)
            if (metadata.campaignId) {
              // Get current campaign to determine next order
              const campaign = await getCampaign(metadata.campaignId);
              const nextOrder = campaign ? campaign.items.length : 0;

              // Create campaign item linking video to campaign (questions are on the video)
              await createCampaignItem(
                metadata.campaignId,
                videoId,
                nextOrder
                // Questions removed - they're stored on the video now
              );
            }

            savedVideos.push(video.id);
          } catch (error) {
            console.error(`Failed to save video ${i + 1}:`, error);
            throw new Error(`Failed to save video ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // 5. Remove saved videos from session items and clear selection
        setSessionItems((prev) => prev.filter((item) => !savedVideos.includes(item.id)));
        setSelectedVideoIds([]);

        // 6. Close modal and show success
        setShowSaveModal(false);
        setVideosToSave([]);
        showSuccess("Videos Saved", `Successfully saved ${savedVideos.length} video(s) to library!`);
      } catch (error) {
        console.error("Failed to save videos:", error);
        showError("Save Failed", error instanceof Error ? error.message : 'Failed to save videos');
      } finally {
        setSavingToLibrary(false);
      }
    },
    [user, videosToSave, setSessionItems, thumbnailMap, fetchThumbnailBlob, showSuccess, showError],
  );

  const handleCloseSaveModal = useCallback(() => {
    if (!savingToLibrary) {
      setShowSaveModal(false);
      setVideosToSave([]);
    }
  }, [savingToLibrary]);

  const handleRemove = useCallback(
    async (item: VideoItem) => {
      if (!item?.id) return;

      const libraryDocumentId = (item as { libraryDocumentId?: string }).libraryDocumentId;

      // If it's a library video (saved to Firestore), handle deletion properly
      if (libraryDocumentId) {
        try {
          // Check if video is used in any campaigns
          const campaigns = await getCampaignsByVideo(libraryDocumentId);

          // Show modal with appropriate state
          setDeleteModalState({
            isOpen: true,
            video: item,
            campaigns: campaigns.length > 0 ? campaigns : null,
            isDeleting: false,
          });
        } catch (error) {
          console.error('Failed to check campaign usage:', error);
          setDeleteModalState({
            isOpen: true,
            video: item,
            campaigns: null,
            isDeleting: false,
          });
        }
      } else {
        // Session video - just remove from local state
        setSessionItems((prev) => prev.filter((existing) => existing.id !== item.id));
        if (preview.previewingId === item.id) {
          preview.clearPreview();
        }
      }
    },
    [preview, setSessionItems],
  );

  const handleConfirmDelete = useCallback(async () => {
    const { video } = deleteModalState;
    if (!video) return;

    const libraryDocumentId = (video as { libraryDocumentId?: string }).libraryDocumentId;
    if (!libraryDocumentId) return;

    setDeleteModalState(prev => ({ ...prev, isDeleting: true }));

    try {
      // Delete from Firestore
      await deleteVideoDoc(libraryDocumentId, false);

      // Delete from Storage if it's an uploaded video
      if (video.download_url && video.source === 'uploaded') {
        try {
          const pathMatch = video.download_url.match(/videos%2F[^?]+/);
          if (pathMatch) {
            const path = decodeURIComponent(pathMatch[0].replace(/%2F/g, '/'));
            await deleteVideoStorage(path);
          }
        } catch (storageError) {
          console.warn('Failed to delete video from storage:', storageError);
          // Continue even if storage deletion fails
        }
      }

      // Close modal
      setDeleteModalState({ isOpen: false, video: null, campaigns: null, isDeleting: false });
      console.log('✅ Video deleted successfully');
      showSuccess("Video Deleted", "The video has been successfully deleted.");
    } catch (error) {
      console.error('Failed to delete video:', error);
      setDeleteModalState(prev => ({ ...prev, isDeleting: false }));
      showError("Delete Failed", error instanceof Error ? error.message : 'Failed to delete video');
    }
  }, [deleteModalState, showSuccess, showError]);

  const handleRetry = useCallback(
    async (item: VideoItem) => {
      if (!item?.id) return;
      const nextPrompt = ensurePrompt(item, prompt);
      applyVideoToForm(item, nextPrompt);
      setRemixId(item.remix_video_id || "");
      setCurrentTitle(item.title || "");
      preview.clearPreview();
      closeMobileSidebar();
      if (item.image_input_required) {
        console.log(IMAGE_INPUT_ALERT);
        scrollToTop();
        return;
      }
      await handleCreateVideo({
        overridePrompt: nextPrompt,
        overrideModel: item.model,
        overrideSize: item.size,
        overrideSeconds: item.seconds as SoraSeconds,
        overrideRemixId: item.remix_video_id,
        overrideTitle: item.title,
        replaceId: item.id,
      });
    },
    [
      applyVideoToForm,
      closeMobileSidebar,
      preview,
      handleCreateVideo,
      prompt,
      setCurrentTitle,
      setRemixId,
    ],
  );

  const handleLocalImageSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setCurrentTitle("");
      setSelectedGeneratedImageId(null);
      if (event?.target?.files?.length) {
        setGeneratedImages([]);
        setGeneratedImageError("");
      }
      await handleImageSelect(event);
    },
    [handleImageSelect, setCurrentTitle],
  );

  const handleGenerateInputImages = useCallback(async () => {
    if (!derivedPromptForImages) {
      setGeneratedImageError("Provide a prompt before generating reference images.");
      setGeneratedImages([]);
      setSelectedGeneratedImageId(null);
      return;
    }

    setCurrentTitle("");
    setGeneratingImages(true);
    setGeneratedImageError("");
    setGeneratedImages([]);
    setSelectedGeneratedImageId(null);

    try {
      const normalizedCount = Math.max(
        1,
        Math.min(4, Number.isFinite(versionsCount) ? Math.round(versionsCount) : 3),
      );

      const images = await generateImages({
        prompt: derivedPromptForImages,
        size: imageGenerationSize,
        count: normalizedCount,
        model: IMAGE_GENERATION_MODEL,
      });

      setGeneratedImages(images);
      if (images.length === 0) {
        setGeneratedImageError("No images returned. Try another prompt.");
      }
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Failed to generate images.";
      setGeneratedImageError(message);
    } finally {
      setGeneratingImages(false);
    }
  }, [
    derivedPromptForImages,
    imageGenerationSize,
    setCurrentTitle,
    versionsCount,
  ]);

  const handleGeneratedImageSelect = useCallback(
    async (image: GeneratedImageSuggestion) => {
      if (!image?.url) return;
      setCurrentTitle("");
      setGeneratedImageError("");
      setSelectedGeneratedImageId(image.id);
      try {
        if (image.url.startsWith("data:")) {
          await handleGeneratedImageDataUrl(image.url, `${image.id}.png`);
        } else {
          await handleGeneratedImageUrl(image.url, `${image.id}.png`);
        }
      } catch (error) {
        console.error(error);
        setGeneratedImageError(
          error instanceof Error
            ? error.message
            : "Failed to apply generated image.",
        );
      }
    },
    [handleGeneratedImageDataUrl, handleGeneratedImageUrl, setCurrentTitle],
  );

  const handleSuggestPrompt = useCallback(async () => {
    setCurrentTitle("");
    setGeneratingPrompt(true);
    try {
      const suggestion = await suggestVideoPrompt({
        prompt,
        seconds,
        model,
        size,
      });

      const trimmed = suggestion.trim();
      if (!trimmed) {
        console.log("Prompt suggestion unavailable. Try again.");
        return;
      }

      setPrompt(trimmed);
      setSelectedGeneratedImageId(null);
      setGeneratedImages([]);
      setGeneratedImageError("");
    } catch (error) {
      console.error("Prompt suggestion failed", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate a prompt suggestion.";
      console.log(message);
    } finally {
      setGeneratingPrompt(false);
    }
  }, [
    model,
    prompt,
    seconds,
    setCurrentTitle,
    setGeneratedImageError,
    setGeneratedImages,
    setPrompt,
    setSelectedGeneratedImageId,
    size,
  ]);

  const handlePromptChange = useCallback(
    (value: string) => {
      setCurrentTitle("");
      setPrompt(value);
    },
    [setCurrentTitle, setPrompt],
  );

  return (
    <>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
        <div className="w-full xl:flex-1 min-w-0 flex flex-col">
          {/* Mobile sidebar toggle - only visible on mobile */}
          <div className="xl:hidden mb-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={openMobileSidebar}
              className="h-9 w-9 rounded-lg border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              aria-label="Open generations sidebar"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 flex flex-col">
            <VideoForm
              sessionItemsCount={sessionItems.length}
            prompt={prompt}
            onPromptChange={handlePromptChange}
            model={model}
            onModelChange={(value) => setModel(sanitizeModel(value))}
            modelOptions={MODEL_OPTIONS}
            size={size}
            onSizeChange={(value) => setSize(sanitizeSizeForModel(value, model))}
            sizeOptionGroups={sizeOptionGroups}
            seconds={seconds}
            onSecondsChange={(value) => setSeconds(value)}
            versionsCount={versionsCount}
            onVersionsCountChange={setVersionsCount}
            remixId={remixId}
            onRemixIdChange={setRemixId}
            onImageSelect={handleLocalImageSelect}
            imagePreviewUrl={imagePreviewUrl}
            imagePreviewMeta={imagePreviewMeta}
            onGenerateImages={handleGenerateInputImages}
            generatingImages={generatingImages}
            generatedImages={generatedImages}
            onSelectGeneratedImage={handleGeneratedImageSelect}
            selectedGeneratedImageId={selectedGeneratedImageId}
            generatedImageError={generatedImageError}
            activeAssets={activeAssets}
            onAddAsset={addAssetToActivePrompt}
            onRemoveAsset={removeAssetFromActivePrompt}
            onSubmit={() => handleCreateVideo()}
            onClear={handleResetForm}
            onGeneratePrompt={handleSuggestPrompt}
            generatingPrompt={generatingPrompt}
            submitting={submitting}
            canSubmit={prompt.trim().length > 0}
            generatingTitle={generatingTitle}
            currentTitle={currentTitle}
            batchProgress={batchProgress}
            remixDisabled={Boolean(remixId)}
            shotsEnabled={shotsEnabled}
            sharedSettingsLocked={sharedSettingsLocked}
            shots={shots}
            activeShotIndex={activeShotIndex}
            onToggleShots={toggleShots}
            onAddShot={addShot}
            onRemoveShot={removeShot}
            onDuplicateShot={duplicateShot}
            onSelectShot={selectShot}
              draftNoticeVisible={draftNoticeVisible}
              onDismissDraftNotice={dismissDraftNotice}
              onClearDraft={clearDraft}
            />
          </div>
        </div>
        <VideoSidebar
          className="xl:flex-shrink-0"
          items={sessionItems}
          thumbnails={thumbnailMap}
          loading={false}
          onDownloadAll={handleDownloadAll}
          downloadingAll={downloadingAll}
          onDownload={handleDownload}
          onPlayPreview={handlePlayPreview}
          onRemix={handleRemixFrom}
          onAddShot={handleAddShot}
          onRetry={handleRetry}
          onRefresh={handleRefreshVideo}
          onRemove={handleRemove}
          onMergeSelected={handleMergeSelected}
          onSaveSelected={handleSaveSelected}
          selectedVideoIds={selectedVideoIds}
          onToggleSelection={handleToggleSelection}
          refreshingMap={refreshingVideos}
          previewState={previewState}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={closeMobileSidebar}
        />
      </div>
      {showPreviewSpinner ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-950/70 px-4 py-4 backdrop-blur">
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/95 px-4 py-3 text-sm font-medium text-foreground shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            Loading preview…
          </div>
        </div>
      ) : null}
      <VideoPreviewOverlay
        isOpen={Boolean(preview.previewingId)}
        item={currentPreviewItem}
        previewUrl={preview.previewUrl}
        loading={preview.previewLoading}
        onClose={handlePreviewClose}
        onPrev={() => handlePreviewNavigate(-1)}
        onNext={() => handlePreviewNavigate(1)}
        hasPrev={hasPrevPreview}
        hasNext={hasNextPreview}
        onDownload={handleDownload}
      />
      {showSaveModal && videosToSave.length > 0 && (
        <SaveToLibraryModal
          isOpen={showSaveModal}
          onClose={handleCloseSaveModal}
          videos={videosToSave}
          onSaveAll={handleSaveAllToLibrary}
          saving={savingToLibrary}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalState.isOpen && deleteModalState.video && (
        <Modal
          isOpen={deleteModalState.isOpen}
          onClose={() => !deleteModalState.isDeleting && setDeleteModalState({ isOpen: false, video: null, campaigns: null, isDeleting: false })}
          title={deleteModalState.campaigns ? "Cannot Delete Video" : "Delete Video"}
          size="md"
        >
          {deleteModalState.campaigns ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900 mb-2">
                    This video is currently in use
                  </p>
                  <p className="text-sm text-amber-800">
                    "{deleteModalState.video.title || 'This video'}" is used in {deleteModalState.campaigns.length} campaign(s):
                  </p>
                  <ul className="mt-2 space-y-1">
                    {deleteModalState.campaigns.map((campaign, idx) => (
                      <li key={idx} className="text-sm text-amber-800 ml-4">
                        • {campaign.title}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-amber-800 mt-3">
                    Please remove this video from all campaigns before deleting it.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setDeleteModalState({ isOpen: false, video: null, campaigns: null, isDeleting: false })}
                  className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900 mb-1">
                    Permanently delete this video?
                  </p>
                  <p className="text-sm text-red-800">
                    You're about to delete "{deleteModalState.video.title || 'this video'}". This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteModalState({ isOpen: false, video: null, campaigns: null, isDeleting: false })}
                  disabled={deleteModalState.isDeleting}
                  className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteModalState.isDeleting}
                  className="rounded-2xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {deleteModalState.isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {deleteModalState.isDeleting ? 'Deleting...' : 'Delete Video'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
