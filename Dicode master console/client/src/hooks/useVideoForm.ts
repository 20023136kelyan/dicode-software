import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import usePersistedState from "@/hooks/usePersistedState";
import type { Asset } from "@/lib/types";
import {
  DEFAULT_SIZE,
  MAX_SHOT_COUNT,
  MODEL_OPTIONS,
  SECONDS_OPTIONS,
  getModelSizeOptions,
  sanitizeModel,
  sanitizeSizeForModel,
  ensurePrompt,
  parseSize,
  sanitizeSeconds,
  type ShotConfig,
  type SoraModel,
  type SizeOptionGroups,
  type VideoItem,
  type SoraSeconds,
} from "@/utils/video";
import { cropImageToCover, dataUrlToFile, fetchImageAsFile } from "@/utils/image";

const VIDEO_DRAFT_KEY = "videogen.videoDraft.v1";

interface DraftPayload {
  singlePrompt: string;
  shotsEnabled: boolean;
  shots: ShotConfig[];
  promptAssets: Asset[];
  shotAssets: Record<string, Asset[]>;
  model: SoraModel;
  size: string;
  baseSeconds: SoraSeconds;
  versionsCount: number;
}

export interface ImagePreviewMeta {
  name: string;
  width: number;
  height: number;
}

export interface UseVideoFormResult {
  prompt: string;
  setPrompt: Dispatch<SetStateAction<string>>;
  model: SoraModel;
  setModel: Dispatch<SetStateAction<SoraModel>>;
  size: string;
  setSize: Dispatch<SetStateAction<string>>;
  seconds: SoraSeconds;
  setSeconds: Dispatch<SetStateAction<SoraSeconds>>;
  versionsCount: number;
  setVersionsCount: Dispatch<SetStateAction<number>>;
  remixId: string;
  setRemixId: Dispatch<SetStateAction<string>>;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  imagePreviewMeta: ImagePreviewMeta | null;
  handleImageSelect: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  applyImageFile: (file: File | null, currentSize?: string) => Promise<void>;
  handleGeneratedImageDataUrl: (
    dataUrl: string,
    filename?: string,
    currentSize?: string,
  ) => Promise<void>;
  handleGeneratedImageUrl: (url: string, filename?: string, currentSize?: string) => Promise<void>;
  clearForm: () => void;
  applyVideoToForm: (item: Partial<VideoItem> | null, currentPrompt?: string) => void;
  sizeOptionGroups: SizeOptionGroups;
  shotsEnabled: boolean;
  sharedSettingsLocked: boolean;
  shots: ShotConfig[];
  activeShotIndex: number;
  toggleShots: (enabled: boolean) => void;
  addShot: () => void;
  removeShot: (shotId: string) => void;
  duplicateShot: (shotId: string) => void;
  selectShot: (index: number) => void;
  updateShotPrompt: (shotId: string, value: string) => void;
  updateShotSeconds: (shotId: string, value: SoraSeconds) => void;
  activeAssets: Asset[];
  addAssetToActivePrompt: (asset: Asset) => void;
  removeAssetFromActivePrompt: (assetId: string) => void;
  assetsState: {
    base: Asset[];
    shots: Record<string, Asset[]>;
  };
  draftNoticeVisible: boolean;
  dismissDraftNotice: () => void;
  clearDraft: () => void;
}

const resolveSetState = <T,>(action: SetStateAction<T>, previous: T): T =>
  typeof action === "function" ? (action as (value: T) => T)(previous) : action;

const randomShotId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const useVideoForm = (): UseVideoFormResult => {
  const [singlePrompt, setSinglePrompt] = useState<string>("");
  const [model, setModel] = usePersistedState<SoraModel>("sora.model", MODEL_OPTIONS[0]);
  const [size, setSize] = usePersistedState<string>("sora.size", DEFAULT_SIZE);
  const [baseSeconds, setBaseSeconds] = usePersistedState<SoraSeconds>("sora.seconds", "4");
  const [versionsCountState, setVersionsCountState] = usePersistedState("sora.versions", 1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null);
  const [remixId, setRemixId] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imagePreviewMeta, setImagePreviewMeta] = useState<ImagePreviewMeta | null>(null);
  const [shotsEnabled, setShotsEnabled] = useState<boolean>(false);
  const [shots, setShots] = useState<ShotConfig[]>([]);
  const [activeShotIndex, setActiveShotIndex] = useState<number>(0);
  const [promptAssets, setPromptAssets] = useState<Asset[]>([]);
  const [shotAssets, setShotAssets] = useState<Record<string, Asset[]>>({});
  const [draftRestored, setDraftRestored] = useState(false);
  const [showDraftNotice, setShowDraftNotice] = useState(false);

  const createShotConfig = useCallback(
    (overrides?: Partial<ShotConfig>): ShotConfig => ({
      id: overrides?.id ?? randomShotId(),
      prompt: overrides?.prompt ?? "",
      seconds: sanitizeSeconds(overrides?.seconds ?? baseSeconds ?? SECONDS_OPTIONS[0]),
      seed: overrides?.seed ?? null,
      notes: overrides?.notes ?? null,
    }),
    [baseSeconds],
  );

  useEffect(() => {
    if (!shotsEnabled) return;
    if (!shots.length) {
      setActiveShotIndex(0);
      return;
    }
    if (activeShotIndex > shots.length - 1) {
      setActiveShotIndex(shots.length - 1);
    }
  }, [activeShotIndex, shots.length, shotsEnabled]);

  const activeShot = shots[activeShotIndex] ?? null;
  const activeShotId = activeShot?.id ?? null;
  const prompt = shotsEnabled ? activeShot?.prompt ?? "" : singlePrompt;
  const seconds = shotsEnabled ? activeShot?.seconds ?? baseSeconds : baseSeconds;
  const sharedSettingsLocked = shotsEnabled;
  const versionsCount = shotsEnabled ? 1 : versionsCountState;
  const activeAssets = shotsEnabled
    ? activeShotId
      ? shotAssets[activeShotId] ?? []
      : []
    : promptAssets;

  const resolvedModel = sanitizeModel(model);
  useEffect(() => {
    if (model !== resolvedModel) {
      setModel(resolvedModel);
    }
  }, [model, resolvedModel, setModel]);

  const resolvedSize = sanitizeSizeForModel(size, resolvedModel);
  useEffect(() => {
    if (size !== resolvedSize) {
      setSize(resolvedSize);
    }
  }, [size, resolvedSize, setSize]);

  const sizeOptionGroups = useMemo<SizeOptionGroups>(
    () => getModelSizeOptions(resolvedModel),
    [resolvedModel],
  );

  useEffect(() => {
    if (draftRestored || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(VIDEO_DRAFT_KEY);
    if (!raw) {
      setDraftRestored(true);
      return;
    }
    try {
      const data = JSON.parse(raw) as Partial<DraftPayload>;
      let draftModel = resolvedModel;
      if (data.model) {
        draftModel = sanitizeModel(data.model);
        setModel(draftModel);
      }
      if (data.size) {
        setSize(sanitizeSizeForModel(data.size, draftModel));
      }
      if (typeof data.singlePrompt === "string") {
        setSinglePrompt(data.singlePrompt);
      }
      if (Array.isArray(data.shots)) {
        setShots(data.shots);
        if (data.shotsEnabled) {
          setShotsEnabled(true);
        }
      } else if (data.shotsEnabled) {
        setShotsEnabled(true);
      }
      if (Array.isArray(data.promptAssets)) {
        setPromptAssets(data.promptAssets);
      }
      if (data.shotAssets) {
        setShotAssets(data.shotAssets);
      }
      if (data.baseSeconds) {
        setBaseSeconds(sanitizeSeconds(data.baseSeconds));
      }
      if (typeof data.versionsCount === "number") {
        setVersionsCountState(data.versionsCount);
      }
      const hasContent =
        Boolean(data.singlePrompt?.trim()) ||
        Boolean(data.shots?.length) ||
        Boolean(data.promptAssets?.length) ||
        Boolean(data.shotAssets && Object.keys(data.shotAssets).length);
      if (hasContent) {
        setShowDraftNotice(true);
      }
    } catch (error) {
      console.error("Failed to restore video draft", error);
      window.localStorage.removeItem(VIDEO_DRAFT_KEY);
    } finally {
      setDraftRestored(true);
    }
  }, [
    draftRestored,
    resolvedModel,
    setBaseSeconds,
    setModel,
    setPromptAssets,
    setShotAssets,
    setShots,
    setShotsEnabled,
    setSinglePrompt,
    setSize,
    setVersionsCountState,
  ]);

  const updateShotAssets = useCallback(
    (shotId: string | null, updater: (current: Asset[]) => Asset[]) => {
      if (!shotId) return;
      setShotAssets((prev) => {
        const current = prev[shotId] ?? [];
        const next = updater(current);
        if (next === current) {
          return prev;
        }
        const nextMap = { ...prev };
        if (!next.length) {
          delete nextMap[shotId];
        } else {
          nextMap[shotId] = next;
        }
        return nextMap;
      });
    },
    [],
  );

  const setPromptValue = useCallback(
    (action: SetStateAction<string>) => {
      if (shotsEnabled) {
        setShots((prev) => {
          if (!prev.length) {
            const resolved = resolveSetState(action, singlePrompt);
            const nextShot = createShotConfig({
              prompt: resolved,
              seconds,
            });
            if (promptAssets.length) {
              setShotAssets((current) => ({
                ...current,
                [nextShot.id]: promptAssets,
              }));
              setPromptAssets([]);
            }
            return [nextShot];
          }
          const index = Math.min(Math.max(activeShotIndex, 0), prev.length - 1);
          const currentPrompt = prev[index]?.prompt ?? "";
          const resolved = resolveSetState(action, currentPrompt);
          return prev.map((shot, idx) =>
            idx === index
              ? {
                  ...shot,
                  prompt: resolved,
                }
              : shot,
          );
        });
      } else {
        setSinglePrompt((prev) => resolveSetState(action, prev));
      }
    },
    [activeShotIndex, createShotConfig, promptAssets, seconds, shotsEnabled, singlePrompt],
  );

  const setSecondsValue = useCallback(
    (action: SetStateAction<SoraSeconds>) => {
      if (shotsEnabled) {
        setShots((prev) => {
          if (!prev.length) {
            const resolved = sanitizeSeconds(resolveSetState(action, baseSeconds));
            const nextShot = createShotConfig({
              prompt: prompt || singlePrompt,
              seconds: resolved,
            });
            if (promptAssets.length) {
              setShotAssets((current) => ({
                ...current,
                [nextShot.id]: promptAssets,
              }));
              setPromptAssets([]);
            }
            return [nextShot];
          }
          const index = Math.min(Math.max(activeShotIndex, 0), prev.length - 1);
          const currentSeconds = prev[index]?.seconds ?? baseSeconds;
          const resolved = sanitizeSeconds(resolveSetState(action, currentSeconds));
          return prev.map((shot, idx) =>
            idx === index
              ? {
                  ...shot,
                  seconds: resolved,
                }
              : shot,
          );
        });
      } else {
        setBaseSeconds((prev) => sanitizeSeconds(resolveSetState(action, prev)));
      }
    },
    [activeShotIndex, baseSeconds, createShotConfig, prompt, promptAssets, shotsEnabled, singlePrompt],
  );

  const addAssetToActivePrompt = useCallback(
    (asset: Asset) => {
      // Asset types that only allow one at a time
      const singletonTypes: Asset['type'][] = ['environment', 'lighting', 'camera'];
      const isSingleton = singletonTypes.includes(asset.type);

      if (shotsEnabled) {
        updateShotAssets(activeShotId, (current) => {
          // Check if already added
          if (current.some((item) => item.id === asset.id)) {
            return current;
          }

          // If singleton type, remove any existing assets of the same type
          if (isSingleton) {
            const filtered = current.filter((item) => item.type !== asset.type);
            return [...filtered, asset];
          }

          return [...current, asset];
        });
      } else {
        setPromptAssets((current) => {
          // Check if already added
          if (current.some((item) => item.id === asset.id)) {
            return current;
          }

          // If singleton type, remove any existing assets of the same type
          if (isSingleton) {
            const filtered = current.filter((item) => item.type !== asset.type);
            return [...filtered, asset];
          }

          return [...current, asset];
        });
      }
    },
    [activeShotId, shotsEnabled, updateShotAssets],
  );

  const removeAssetFromActivePrompt = useCallback(
    (assetId: string) => {
      if (shotsEnabled) {
        updateShotAssets(activeShotId, (current) =>
          current.filter((item) => item.id !== assetId),
        );
      } else {
        setPromptAssets((current) => current.filter((item) => item.id !== assetId));
      }
    },
    [activeShotId, shotsEnabled, updateShotAssets],
  );

  const setVersionsCountSafe = useCallback(
    (action: SetStateAction<number>) => {
      if (shotsEnabled) {
        setVersionsCountState(1);
        return;
      }
      setVersionsCountState(action);
    },
    [setVersionsCountState, shotsEnabled],
  );

  const ensureInitialShot = useCallback((): ShotConfig | null => {
    let created: ShotConfig | null = null;
    setShots((prev) => {
      if (prev.length) {
        created = prev[0];
        return prev;
      }
      const nextShot = createShotConfig({
        prompt: singlePrompt,
        seconds: baseSeconds,
      });
      created = nextShot;
      return [nextShot];
    });
    return created;
  }, [baseSeconds, createShotConfig, singlePrompt]);

  const toggleShots = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        const initialShot = ensureInitialShot();
        if (initialShot && promptAssets.length) {
          setShotAssets((current) => ({
            ...current,
            [initialShot.id]: promptAssets,
          }));
          setPromptAssets([]);
        }
        setShotsEnabled(true);
        setVersionsCountState(1);
        return;
      }
      setShotsEnabled(false);
      setActiveShotIndex(0);
      const fallback = shots[activeShotIndex];
      if (fallback) {
        setSinglePrompt(fallback.prompt);
        setBaseSeconds(fallback.seconds);
        const fallbackAssets = shotAssets[fallback.id] ?? [];
        setPromptAssets(fallbackAssets);
      } else {
        setPromptAssets([]);
      }
      setShotAssets({});
    },
    [
      activeShotIndex,
      ensureInitialShot,
      promptAssets,
      setBaseSeconds,
      setSinglePrompt,
      setVersionsCountState,
      shotAssets,
      shots,
    ],
  );

  const addShot = useCallback(() => {
    let createdShot: ShotConfig | null = null;
    let inheritedAssets: Asset[] = [];
    setShots((prev) => {
      if (prev.length >= MAX_SHOT_COUNT) return prev;
      const template = prev[prev.length - 1];
      createdShot = createShotConfig({
        prompt: template?.prompt ?? prompt ?? singlePrompt,
        seconds: template?.seconds ?? seconds,
        seed: template?.seed ?? null,
        notes: template?.notes ?? null,
      });
      if (template?.id) {
        inheritedAssets = [...(shotAssets[template.id] ?? [])];
      } else {
        inheritedAssets = [];
      }
      const nextShots = [...prev, createdShot];
      setActiveShotIndex(nextShots.length - 1);
      return nextShots;
    });
    if (createdShot) {
      setShotAssets((current) => ({
        ...current,
        [createdShot!.id]: inheritedAssets,
      }));
    }
    setShotsEnabled(true);
    setVersionsCountState(1);
  }, [createShotConfig, prompt, seconds, setVersionsCountState, shotAssets, singlePrompt]);

  const removeShot = useCallback((shotId: string) => {
    setShots((prev) => {
      if (prev.length <= 1) return prev;
      const index = prev.findIndex((shot) => shot.id === shotId);
      if (index === -1) return prev;
      const nextShots = prev.filter((shot) => shot.id !== shotId);
      setActiveShotIndex((current) => {
        if (!nextShots.length) return 0;
        if (current > nextShots.length - 1) return nextShots.length - 1;
        if (index < current) return current - 1;
        if (index === current) return Math.max(0, current - 1);
        return current;
      });
      return nextShots;
    });
    setShotAssets((prev) => {
      if (!prev[shotId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[shotId];
      return next;
    });
  }, []);

  const duplicateShot = useCallback(
    (shotId: string) => {
      let duplicatedShot: ShotConfig | null = null;
      let duplicatedAssets: Asset[] = [];
      setShots((prev) => {
        if (!prev.length || prev.length >= MAX_SHOT_COUNT) return prev;
        const index = prev.findIndex((shot) => shot.id === shotId);
        if (index === -1) return prev;
        const source = prev[index];
        duplicatedShot = createShotConfig({
          prompt: source.prompt,
          seconds: source.seconds,
          seed: source.seed ?? null,
          notes: source.notes ?? null,
        });
        duplicatedAssets = source.id ? [...(shotAssets[source.id] ?? [])] : [];
        const nextShots = [
          ...prev.slice(0, index + 1),
          duplicatedShot,
          ...prev.slice(index + 1),
        ].slice(0, MAX_SHOT_COUNT);
        setActiveShotIndex(Math.min(index + 1, nextShots.length - 1));
        return nextShots;
      });
      if (duplicatedShot) {
        setShotAssets((current) => ({
          ...current,
          [duplicatedShot!.id]: duplicatedAssets,
        }));
      }
      setShotsEnabled(true);
      setVersionsCountState(1);
    },
    [createShotConfig, setVersionsCountState, shotAssets],
  );

  const selectShot = useCallback(
    (index: number) => {
      setActiveShotIndex(() => {
        if (!shots.length) return 0;
        const clamped = Math.min(Math.max(index, 0), shots.length - 1);
        return clamped;
      });
    },
    [shots.length],
  );

  const updateShotPrompt = useCallback((shotId: string, value: string) => {
    setShots((prev) =>
      prev.map((shot) => (shot.id === shotId ? { ...shot, prompt: value } : shot)),
    );
  }, []);

  const updateShotSeconds = useCallback((shotId: string, value: SoraSeconds) => {
    setShots((prev) =>
      prev.map((shot) => (shot.id === shotId ? { ...shot, seconds: value } : shot)),
    );
  }, []);

  const lastCroppedImageKeyRef = useRef<string | null>(null);

  const clearImagePreview = useCallback(() => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
    setImagePreviewMeta(null);
    lastCroppedImageKeyRef.current = null;
  }, [imagePreviewUrl]);

  useEffect(
    () => () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    },
    [imagePreviewUrl],
  );

  const applyCroppedImage = useCallback(
    async (file: File, sizeStr: string) => {
      const key = `${file.name || "file"}-${file.lastModified || ""}-${sizeStr}`;
      if (lastCroppedImageKeyRef.current === key) return;
      lastCroppedImageKeyRef.current = key;
      const { width, height } = parseSize(sizeStr);
      try {
        const cropped = await cropImageToCover(file, width, height);
        setImageFile(cropped);
        setImagePreviewMeta({
          name: cropped.name,
          width,
          height,
        });
        const nextUrl = URL.createObjectURL(cropped);
        setImagePreviewUrl((prevUrl) => {
          if (prevUrl) URL.revokeObjectURL(prevUrl);
          return nextUrl;
        });
      } catch (error) {
        lastCroppedImageKeyRef.current = null;
        throw error;
      }
    },
    [],
  );

  const applyImageFile = useCallback(
    async (file: File | null, currentSize = resolvedSize) => {
      if (!file) {
        setImageFile(null);
        setOriginalImageFile(null);
        clearImagePreview();
        return;
      }
      setOriginalImageFile(file);
      await applyCroppedImage(file, currentSize);
    },
    [applyCroppedImage, clearImagePreview, resolvedSize],
  );

  const handleImageSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>, currentSize = resolvedSize) => {
      const file = event.target?.files?.[0];
      if (!file) {
        await applyImageFile(null, currentSize);
        return;
      }
      await applyImageFile(file, currentSize);
    },
    [applyImageFile, resolvedSize],
  );

  const handleGeneratedImageDataUrl = useCallback(
    async (dataUrl: string, filename = "generated.png", currentSize = resolvedSize) => {
      const file = await dataUrlToFile(dataUrl, filename);
      await applyImageFile(file, currentSize);
    },
    [applyImageFile, resolvedSize],
  );

  const handleGeneratedImageUrl = useCallback(
    async (url: string, filename = "generated.png", currentSize = resolvedSize) => {
      const file = await fetchImageAsFile(url, filename);
      await applyImageFile(file, currentSize);
    },
    [applyImageFile, resolvedSize],
  );

  useEffect(() => {
    if (!originalImageFile) return;
    applyCroppedImage(originalImageFile, resolvedSize).catch(() => {
      /* ignore */
    });
  }, [originalImageFile, resolvedSize, applyCroppedImage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: DraftPayload = {
      singlePrompt,
      shotsEnabled,
      shots,
      promptAssets,
      shotAssets,
      model: resolvedModel,
      size: resolvedSize,
      baseSeconds,
      versionsCount: versionsCountState,
    };
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(VIDEO_DRAFT_KEY, JSON.stringify(payload));
      } catch (error) {
        console.error("Failed to persist video draft", error);
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [
    baseSeconds,
    promptAssets,
    resolvedModel,
    resolvedSize,
    shots,
    shotAssets,
    shotsEnabled,
    singlePrompt,
    versionsCountState,
  ]);

  const resetImage = useCallback(() => {
    setImageFile(null);
    setOriginalImageFile(null);
    clearImagePreview();
  }, [clearImagePreview]);

  const clearForm = useCallback(() => {
    setSinglePrompt("");
    setBaseSeconds(SECONDS_OPTIONS[0]);
    resetImage();
    setRemixId("");
    setShots([]);
    setShotAssets({});
    setPromptAssets([]);
    setShotsEnabled(false);
    setActiveShotIndex(0);
  }, [resetImage, setBaseSeconds]);

  const clearDraft = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(VIDEO_DRAFT_KEY);
    }
    setShowDraftNotice(false);
    clearForm();
  }, [clearForm]);

  const dismissDraftNotice = useCallback(() => {
    setShowDraftNotice(false);
  }, []);

  const applyVideoToForm = useCallback(
    (item: Partial<VideoItem> | null, currentPrompt?: string) => {
      if (!item) return;
      const nextPrompt = ensurePrompt(item as VideoItem, currentPrompt ?? prompt);
      setSinglePrompt(nextPrompt);
      setShots([]);
      setShotAssets({});
      setPromptAssets([]);
      setShotsEnabled(false);
      setActiveShotIndex(0);
      const sanitizedModel = sanitizeModel(
        (item.model as string | undefined) ?? MODEL_OPTIONS[0],
      );
      setModel(sanitizedModel);
      setSize(
        sanitizeSizeForModel(
          (item.size as string | undefined) ?? DEFAULT_SIZE,
          sanitizedModel,
        ),
      );
      setBaseSeconds(
        sanitizeSeconds(
          (item.seconds as string | number | null | undefined) ?? SECONDS_OPTIONS[0],
        ),
      );
      resetImage();
    },
    [prompt, resetImage, setBaseSeconds, setModel, setPromptAssets, setShotAssets, setSize],
  );

  const assetsState = useMemo(
    () => ({
      base: promptAssets,
      shots: shotAssets,
    }),
    [promptAssets, shotAssets],
  );

  return {
    prompt,
    setPrompt: setPromptValue,
    model: resolvedModel,
    setModel,
    size: resolvedSize,
    setSize,
    seconds,
    setSeconds: setSecondsValue,
    versionsCount,
    setVersionsCount: setVersionsCountSafe,
    remixId,
    setRemixId,
    imageFile,
    imagePreviewUrl,
    imagePreviewMeta,
    handleImageSelect,
    applyImageFile,
    handleGeneratedImageDataUrl,
    handleGeneratedImageUrl,
    clearForm,
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
    updateShotPrompt,
    updateShotSeconds,
    activeAssets,
    addAssetToActivePrompt,
    removeAssetFromActivePrompt,
    assetsState,
    draftNoticeVisible: showDraftNotice,
    dismissDraftNotice,
    clearDraft,
  };
};

export default useVideoForm;

