import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  Clapperboard,
  Copy,
  ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { AssetPickerRow } from "@/components/assets/AssetPickerRow";
import { SelectedAssetChips } from "@/components/assets/SelectedAssetChips";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "../ui";
import {
  MAX_SHOT_COUNT,
  SECONDS_OPTIONS,
  type ShotConfig,
  type SizeOptionGroups,
  type SoraModel,
  type SoraSeconds,
} from "../utils/video";
import type { ImagePreviewMeta } from "../hooks/useVideoForm";
import type { Asset } from "@/lib/types";
import type { GeneratedImageSuggestion } from "@/types/generated";

type AsyncMaybe = void | Promise<unknown>;

const VERSION_OPTIONS = [1, 2, 3, 4];

type OrientationId = "portrait" | "landscape";

const formatSizeKey = (orientation: OrientationId, sizeValue: string) =>
  `${orientation}|${sizeValue}`;

const parseSizeKey = (
  key: string,
): { orientation: OrientationId; size: string } => {
  const [rawOrientation, rawSize] = key.split("|", 2);
  const orientation: OrientationId =
    rawOrientation === "portrait" ? "portrait" : "landscape";
  return { orientation, size: rawSize ?? key };
};

const deriveSizeKey = (
  sizeValue: string,
  groups: SizeOptionGroups,
  preferredOrientation?: OrientationId,
) => {
  const matches = (orientation: OrientationId) => {
    const options = groups[orientation] ?? [];
    return options.includes(sizeValue)
      ? formatSizeKey(orientation, sizeValue)
      : null;
  };

  if (preferredOrientation) {
    const preferred = matches(preferredOrientation);
    if (preferred) return preferred;
  }

  return (
    matches("portrait") ||
    matches("landscape") ||
    formatSizeKey("landscape", sizeValue)
  );
};

const CONTROL_TRIGGER_CLASS =
  "flex h-9 items-center gap-2 rounded-full border border-border/60 bg-card px-3 text-sm text-foreground/90 shadow-none transition-colors focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 data-[state=open]:bg-card/90";

const CONTROL_TRIGGER_CONTENT_CLASS = "flex w-full items-center gap-3";

const CONTROL_TRIGGER_LABEL_CLASS =
  "mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground";

const CONTROL_TRIGGER_VALUE_CLASS = "flex-1 truncate text-foreground";

const CONTROL_CONTENT_CLASS =
  "rounded-xl border border-border/60 bg-card/95 p-0 shadow-none";

export interface BatchProgressState {
  total: number;
  current: number;
  mode?: "versions" | "shots";
}

export interface VideoFormProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  model: SoraModel;
  onModelChange: (value: SoraModel) => void;
  modelOptions: readonly SoraModel[];
  size: string;
  onSizeChange: (value: string) => void;
  sizeOptionGroups: SizeOptionGroups;
  seconds: SoraSeconds;
  onSecondsChange: (value: SoraSeconds) => void;
  versionsCount: number;
  onVersionsCountChange: (value: number) => void;
  remixId: string;
  onRemixIdChange: (value: string) => void;
  onImageSelect: (event: ChangeEvent<HTMLInputElement>) => AsyncMaybe;
  imagePreviewUrl: string | null;
  imagePreviewMeta: ImagePreviewMeta | null;
  onGenerateImages: () => AsyncMaybe;
  generatingImages: boolean;
  generatedImages: GeneratedImageSuggestion[];
  onSelectGeneratedImage: (image: GeneratedImageSuggestion) => AsyncMaybe;
  selectedGeneratedImageId: string | null;
  generatedImageError: string;
  activeAssets: Asset[];
  onAddAsset: (asset: Asset) => void;
  onRemoveAsset: (assetId: string) => void;
  onSubmit: () => AsyncMaybe;
  onClear: () => void;
  onGeneratePrompt?: () => AsyncMaybe;
  generatingPrompt?: boolean;
  submitting: boolean;
  canSubmit: boolean;
  generatingTitle: boolean;
  currentTitle: string;
  batchProgress: BatchProgressState | null;
  remixDisabled: boolean;
  shotsEnabled: boolean;
  sharedSettingsLocked: boolean;
  shots: ShotConfig[];
  activeShotIndex: number;
  onToggleShots: (enabled: boolean) => void;
  onAddShot: () => void;
  onRemoveShot: (shotId: string) => void;
  onDuplicateShot: (shotId: string) => void;
  onSelectShot: (index: number) => void;
  draftNoticeVisible: boolean;
  onDismissDraftNotice: () => void;
  onClearDraft: () => void;
}

const PRO_TIPS = [
  "Lead with subject + action + setting to anchor Sora.",
  "Layer assets for consistent branding across renders.",
  "Add camera + lighting cues for cinematic motion.",
  "Keep prompts under 3 paragraphs for highest fidelity.",
];

const VideoForm = ({
  prompt,
  onPromptChange,
  model,
  onModelChange,
  modelOptions,
  size,
  onSizeChange,
  sizeOptionGroups,
  seconds,
  onSecondsChange,
  versionsCount,
  onVersionsCountChange,
  remixId,
  onRemixIdChange,
  onImageSelect,
  imagePreviewUrl,
  imagePreviewMeta,
  onGenerateImages,
  generatingImages,
  generatedImages = [],
  onSelectGeneratedImage,
  selectedGeneratedImageId,
  generatedImageError,
  activeAssets,
  onAddAsset,
  onRemoveAsset,
  onSubmit,
  onClear,
  onGeneratePrompt,
  generatingPrompt = false,
  submitting,
  canSubmit,
  generatingTitle,
  currentTitle,
  batchProgress,
  remixDisabled,
  shotsEnabled,
  sharedSettingsLocked,
  shots,
  activeShotIndex,
  onToggleShots,
  onAddShot,
  onRemoveShot,
  onDuplicateShot,
  onSelectShot,
  draftNoticeVisible,
  onDismissDraftNotice,
  onClearDraft,
}: VideoFormProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previousPromptRef = useRef(prompt);
  const [tipIndex, setTipIndex] = useState(0);
  const versionValue = useMemo(() => {
    const parsed = Number(versionsCount) || 1;
    const normalized = Math.min(4, Math.max(1, parsed));
    return String(normalized);
  }, [versionsCount]);

  const sizeSections = useMemo(
    () =>
      (
        [
          {
            id: "portrait" as OrientationId,
            label: "Portrait",
            options: sizeOptionGroups.portrait,
          },
          {
            id: "landscape" as OrientationId,
            label: "Landscape",
            options: sizeOptionGroups.landscape,
          },
        ] as const
      ).filter((section) => section.options.length > 0),
    [sizeOptionGroups],
  );

  const [sizeSelectionKey, setSizeSelectionKey] = useState(() =>
    deriveSizeKey(size, sizeOptionGroups),
  );

  useEffect(() => {
    setSizeSelectionKey((previous) => {
      const { orientation } = parseSizeKey(previous);
      const next = deriveSizeKey(size, sizeOptionGroups, orientation);
      return previous === next ? previous : next;
    });
  }, [size, sizeOptionGroups]);

  const hasPrompt = prompt.trim().length > 0;
  const promptTooltip = hasPrompt
    ? "Uses your current prompt to guide the result."
    : "Add a prompt to enable this action.";

  const handleGeneratePromptClick = () => {
    if (!hasPrompt || !onGeneratePrompt) return;
    void onGeneratePrompt();
  };

  const handleVersionChange = (value: string) => {
    const parsed = Number(value);
    onVersionsCountChange(Number.isFinite(parsed) ? parsed : 1);
  };

  const handleSizeSelect = (value: string) => {
    const { orientation, size: nextSize } = parseSizeKey(value);
    setSizeSelectionKey(formatSizeKey(orientation, nextSize));
    onSizeChange(nextSize);
  };

  const triggerFileDialog = () => {
    if (remixDisabled) return;
    fileInputRef.current?.click();
  };

  const promptHasImage = Boolean(imagePreviewUrl);
  const activeShotNumber = shotsEnabled
    ? Math.min(activeShotIndex + 1, Math.max(shots.length, 1))
    : 1;
  const shotLimitReached = shots.length >= MAX_SHOT_COUNT;

  const handleAssetSelect = useCallback(
    (asset: Asset) => {
      onAddAsset(asset);
    },
    [onAddAsset],
  );

  const handleAssetRemove = useCallback(
    (assetId: string) => {
      onRemoveAsset(assetId);
    },
    [onRemoveAsset],
  );

  useEffect(() => {
    if (previousPromptRef.current === prompt) return;
    previousPromptRef.current = prompt;
    setTipIndex((prev) => (prev + 1) % PRO_TIPS.length);
  }, [prompt]);

  const currentTip = PRO_TIPS[tipIndex];

  const validationWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!prompt.trim()) {
      warnings.push("Add a prompt so Sora knows what to render.");
    }
    const secondsValue = Number(seconds);
    if (!secondsValue || Number.isNaN(secondsValue) || secondsValue <= 0) {
      warnings.push("Duration must be greater than zero seconds.");
    }
    if (shotsEnabled && activeAssets.length === 0) {
      warnings.push("Shots mode loves structure—attach at least one asset.");
    }
    return warnings;
  }, [prompt, seconds, shotsEnabled, activeAssets.length]);

  return (
    <Card className="flex h-full flex-col overflow-hidden border-none shadow-none">
      <CardContent className="flex flex-1 min-h-0 flex-col overflow-y-auto space-y-6 px-0">
        {draftNoticeVisible && (
          <div className="mx-6 flex flex-wrap items-center justify-between gap-3 rounded-[32px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800">
            <div>
              <p className="text-sm font-semibold">Draft restored</p>
              <p className="text-xs">
                We reloaded your last session. Clear it anytime to start fresh.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClearDraft}
                className="rounded-full border border-emerald-200 px-4 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-white"
              >
                Clear draft
              </button>
              <button
                type="button"
                onClick={onDismissDraftNotice}
                className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold text-emerald-700/70 hover:text-emerald-900"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <section className="rounded-[32px] border border-border/60 bg-card/80 p-6 shadow-[0_0_40px_0px_rgba(0,0,0,0.1)]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <label
                htmlFor="remix-id"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Remix from video ID
              </label>
              <Input
                id="remix-id"
                value={remixId}
                onChange={(event) => onRemixIdChange(event.target.value)}
                placeholder="video_..."
                className="h-9 w-full max-w-xs rounded-none border-0 border-b border-border/70 bg-transparent px-0 text-sm text-foreground shadow-none transition focus-visible:border-border focus-visible:outline-none focus-visible:ring-0"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Prompt & settings
                </p>
                {shotsEnabled ? (
                  <p className="text-[11px] text-muted-foreground">
                    Editing shot {activeShotNumber} of {Math.max(shots.length, 1)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onClearDraft}
                  className="rounded-full border border-border/50 px-3 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-border hover:text-foreground"
                >
                  Clear draft
                </button>
                {shotsEnabled ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1 rounded-full bg-muted/40 p-1">
                      {shots.map((shot, index) => {
                        const isActive = index === activeShotIndex;
                        return (
                          <div
                            key={shot.id}
                            className={cn(
                              "flex items-center gap-1 rounded-full px-3 py-1 text-xs transition",
                              isActive
                                ? "bg-card text-foreground shadow"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => onSelectShot(index)}
                              className="font-semibold"
                            >
                              Shot {index + 1}
                            </button>
                            {index > 0 ? (
                              <button
                                type="button"
                                onClick={() => onRemoveShot(shot.id)}
                                className="text-muted-foreground hover:text-destructive"
                                aria-label={`Remove shot ${index + 1}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                            {!shotLimitReached ? (
                              <button
                                type="button"
                                onClick={() => onDuplicateShot(shot.id)}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={`Duplicate shot ${index + 1}`}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onAddShot}
                      disabled={shotLimitReached}
                      className="rounded-full text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add shot
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onToggleShots(false)}
                      className="h-9 w-9 rounded-full border border-border/60 text-muted-foreground hover:text-foreground"
                      aria-label="Disable shots"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleShots(true)}
                    className="rounded-full text-xs"
                  >
                    <Clapperboard className="h-3.5 w-3.5" />
                    Shots
                  </Button>
                )}
              </div>
            </div>

            <div className="relative rounded-3xl px-1 py-1">
              {activeAssets.length ? (
                <SelectedAssetChips
                  assets={activeAssets}
                  onRemove={handleAssetRemove}
                  className="mb-3 px-4"
                />
              ) : null}
              <InputGroup
                className={cn(
                  "flex gap-0 rounded-xl bg-muted/40 focus-within:ring-0 focus-within:ring-offset-0",
                  remixDisabled ? "opacity-80" : "",
                )}
              >
                <div className="relative w-full">
                  {promptHasImage ? (
                    <div className="absolute left-5 top-5 flex gap-3">
                      <div className="h-16 w-16 overflow-hidden rounded-lg border border-border/50 bg-card/40">
                        {imagePreviewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imagePreviewUrl}
                            alt="Prompt reference"
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <InputGroupTextarea
                    value={prompt}
                    onChange={(event) => onPromptChange(event.target.value)}
                    placeholder="Describe the scene you want Sora to create..."
                    className={cn(
                      "min-h-[320px] w-full resize-none border-0 bg-transparent px-6 pb-16 pt-6 text-base leading-relaxed text-foreground",
                      promptHasImage ? "pl-[7.5rem]" : "",
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClear}
                    className="absolute right-5 top-5 h-8 w-8 rounded-full border border-border/60 bg-card/85 text-muted-foreground hover:text-foreground"
                    aria-label="Clear form"
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  {imagePreviewMeta ? (
                    <p className="text-xs text-muted-foreground pb-2 pl-2">
                      {imagePreviewMeta.name} • {imagePreviewMeta.width}x
                      {imagePreviewMeta.height}
                    </p>
                  ) : null}
                </div>

                <InputGroupAddon
                  align="block-end"
                  className="flex w-full flex-col gap-2 px-4 pb-4 pt-3 text-sm bg-transparent rounded-xl text-muted-foreground"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={remixDisabled}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      void onImageSelect(event);
                    }}
                  />
                  <div className="flex w-full items-center gap-3 overflow-x-auto pb-1">
                    <InputGroupButton
                      size="sm"
                      variant="ghost"
                      onClick={triggerFileDialog}
                      disabled={remixDisabled}
                      className="whitespace-nowrap bg-card rounded-full py-1 border border-dashed border-border/70 px-3 text-sm text-muted-foreground hover:border-border hover:bg-muted/60"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Add image
                    </InputGroupButton>

                    <div className="flex min-w-max items-center gap-2">
                      <Select
                        value={model}
                        onValueChange={(value) => onModelChange(value as SoraModel)}
                        disabled={remixDisabled}
                      >
                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                          <div className={CONTROL_TRIGGER_CONTENT_CLASS}>
                            <span className={CONTROL_TRIGGER_LABEL_CLASS}>
                              Model
                            </span>
                            <div className={CONTROL_TRIGGER_VALUE_CLASS}>
                              <SelectValue placeholder="Model" />
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                            Model
                          </div>
                          {modelOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={sizeSelectionKey}
                        onValueChange={handleSizeSelect}
                        disabled={remixDisabled}
                      >
                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                          <div className={CONTROL_TRIGGER_CONTENT_CLASS}>
                            <span className={CONTROL_TRIGGER_LABEL_CLASS}>
                              Size
                            </span>
                            <div className={CONTROL_TRIGGER_VALUE_CLASS}>
                              <SelectValue placeholder="Size" />
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                          {sizeSections.map((section) => (
                            <Fragment key={section.label}>
                              <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                                {section.label}
                              </div>
                              {section.options.map((option) => (
                                <SelectItem
                                  key={`${section.id}-${option}`}
                                  value={formatSizeKey(section.id, option)}
                                >
                                  {option}
                                </SelectItem>
                              ))}
                            </Fragment>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={seconds}
                        onValueChange={(value) =>
                          onSecondsChange(value as SoraSeconds)}
                        disabled={remixDisabled}
                      >
                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                          <div className={CONTROL_TRIGGER_CONTENT_CLASS}>
                            <span className={CONTROL_TRIGGER_LABEL_CLASS}>
                              Seconds
                            </span>
                            <div className={CONTROL_TRIGGER_VALUE_CLASS}>
                              <SelectValue placeholder="Seconds" />
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                            Duration
                          </div>
                          {SECONDS_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={versionValue}
                        onValueChange={handleVersionChange}
                        disabled={shotsEnabled || remixDisabled}
                      >
                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                          <div className={CONTROL_TRIGGER_CONTENT_CLASS}>
                            <span className={CONTROL_TRIGGER_LABEL_CLASS}>
                              Versions
                            </span>
                            <div className={CONTROL_TRIGGER_VALUE_CLASS}>
                              <SelectValue placeholder="Versions" />
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                            Versions
                          </div>
                          {VERSION_OPTIONS.map((option) => {
                            const value = String(option);
                            return (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </InputGroupAddon>
              </InputGroup>
            </div>

            {sharedSettingsLocked ? (
              <p className="text-[11px] text-muted-foreground">
                Model, size, and version settings apply to every shot to keep visuals consistent.
              </p>
            ) : null}

            <TooltipProvider delayDuration={150}>
              <div className="flex flex-col md:flex-row md:items-center justify-end gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="lg"
                        onClick={handleGeneratePromptClick}
                        disabled={
                          !hasPrompt || generatingPrompt || !onGeneratePrompt
                        }
                        className="w-full rounded-full bg-muted/60 px-5 text-xs text-foreground hover:bg-muted/70 disabled:opacity-50 md:w-auto md:text-sm"
                      >
                        {generatingPrompt ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Generate prompt
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-md border border-border bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-none">
                    {promptTooltip}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="lg"
                        disabled={!hasPrompt || remixDisabled || generatingImages}
                        onClick={() => {
                          if (!hasPrompt) return;
                          void onGenerateImages();
                        }}
                        className="w-full rounded-full bg-muted/60 px-5 text-xs text-foreground hover:bg-muted/70 disabled:opacity-50 md:w-auto md:text-sm"
                      >
                        {generatingImages ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImageIcon className="h-4 w-4" />
                        )}
                        Generate image
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-md border border-border bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-none">
                    {promptTooltip}
                  </TooltipContent>
                </Tooltip>

                <Button
                  onClick={() => {
                    void onSubmit();
                  }}
                  disabled={
                    submitting || !canSubmit
                  }
                  size="lg"
                  className={cn(
                    "rounded-full px-6 text-xs font-semibold md:text-sm disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
                  )}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  Generate video
                </Button>
              </div>
            </TooltipProvider>
          </div>
        </section>

        <AssetPickerRow
          className="rounded-[32px] border border-border/60 bg-card/70 p-5 shadow-[0_0_40px_0px_rgba(0,0,0,0.1)]"
          onAssetSelect={handleAssetSelect}
          selectedAssetIds={activeAssets.map((asset) => asset.id)}
        />

        <div className="space-y-4">
          {generatedImageError ? (
            <p className="text-xs text-destructive">{generatedImageError}</p>
          ) : null}

          {generatedImages.length > 0 ? (
            <section className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-none">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Generated suggestions
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {generatedImages.map((image) => {
                  const isSelected = selectedGeneratedImageId === image.id;
                  return (
                    <Button
                      key={image.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void onSelectGeneratedImage(image);
                      }}
                      className={cn(
                        "group relative flex h-auto w-full overflow-hidden rounded-lg border bg-card p-0",
                        isSelected
                          ? "border-indigo-500 ring-2 ring-indigo-200"
                          : "border-border hover:border-border/70",
                      )}
                    >
                      <div className="relative h-24 w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.url}
                          alt={image.description || "Generated option"}
                          className="h-full w/full object-cover"
                        />
                      </div>
                      {isSelected ? (
                        <span className="absolute inset-0 bg-indigo-500/10" />
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {batchProgress ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                {batchProgress.mode === "shots"
                  ? `Generating shot ${batchProgress.current} of ${batchProgress.total}...`
                  : `Generating version ${batchProgress.current} of ${batchProgress.total}...`}
              </span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoForm;

export type { GeneratedImageSuggestion } from "@/types/generated";

