"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VideoItem } from "@/utils/video";

export interface VideoPreviewOverlayProps {
  isOpen: boolean;
  item: VideoItem | null;
  previewUrl: string | null;
  loading: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onDownload: (item: VideoItem) => void | Promise<unknown>;
}

const VideoPreviewOverlay = ({
  isOpen,
  item,
  previewUrl,
  loading,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onDownload,
}: VideoPreviewOverlayProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft" && hasPrev) {
        onPrev();
      } else if (event.key === "ArrowRight" && hasNext) {
        onNext();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasNext, hasPrev, isOpen, onClose, onNext, onPrev]);

  useEffect(() => {
    setVideoDimensions(null);
  }, [previewUrl]);

  useEffect(() => {
    if (loading || !previewUrl) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => {
      // autoplay might be blocked; ignore
    });
  }, [loading, previewUrl]);

  if (!isOpen || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 px-4 py-8 backdrop-blur"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/95 text-foreground shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-border/60 px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Previewing video
            </p>
            <p className="line-clamp-2 text-lg font-semibold leading-6">
              {item.title?.trim() || "Untitled Video"}
            </p>
            {item.shot_sequence?.shots?.length ? (
              <p className="text-[11px] text-muted-foreground">
                {item.shot_sequence.shots.length} shot sequence
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onDownload(item)}
              className="rounded-full px-3 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
          <div className="relative flex flex-1 min-h-[320px] w-full items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-black/80">
            {loading ? (
              <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading preview…
              </div>
            ) : previewUrl ? (
              <div
                className="flex max-h-full max-w-full items-center justify-center"
                style={
                  videoDimensions
                    ? {
                        aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}`,
                        maxHeight: "100%",
                        maxWidth: "100%",
                      }
                    : { width: "100%", height: "100%" }
                }
              >
                <video
                  ref={videoRef}
                  key={previewUrl}
                  src={previewUrl}
                  controls
                  loop
                  onLoadedMetadata={(event) => {
                    const { videoWidth, videoHeight } = event.currentTarget;
                    if (videoWidth && videoHeight) {
                      setVideoDimensions({
                        width: videoWidth,
                        height: videoHeight,
                      });
                    }
                  }}
                  className="max-h-full max-w-full rounded-lg bg-black"
                />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Preview unavailable. Try downloading instead.
              </div>
            )}
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 sm:pl-4">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={hasPrev ? onPrev : undefined}
                disabled={!hasPrev}
                className={cn(
                  "pointer-events-auto h-9 w-9 rounded-full border border-border/80 bg-card/90 text-foreground shadow transition hover:bg-card",
                )}
                aria-label="Previous video"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 sm:pr-4">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={hasNext ? onNext : undefined}
                disabled={!hasNext}
                className={cn(
                  "pointer-events-auto h-9 w-9 rounded-full border border-border/80 bg-card/90 text-foreground shadow transition hover:bg-card",
                )}
                aria-label="Next video"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPreviewOverlay;

