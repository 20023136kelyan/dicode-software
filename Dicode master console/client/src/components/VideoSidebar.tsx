import { useMemo } from "react";
import { Download, Loader2, X, PlayCircle, Merge, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import VideoCard from "./VideoCard";
import { isCompletedStatus, type VideoItem } from "../utils/video";

type AsyncMaybe = void | Promise<unknown>;

export type SidebarPreviewState = {
  previewingId: string | null;
  previewLoading: boolean;
};

export interface VideoSidebarProps {
  items: VideoItem[];
  thumbnails: Record<string, string>;
  onDownloadAll: () => void;
  downloadingAll: boolean;
  onDownload: (item: VideoItem) => AsyncMaybe;
  onPlayPreview: (item: VideoItem) => AsyncMaybe;
  onRemix: (item: VideoItem) => AsyncMaybe;
  onAddShot: (item: VideoItem) => AsyncMaybe;
  onRetry: (item: VideoItem) => AsyncMaybe;
  onRefresh: (item: VideoItem) => AsyncMaybe;
  onRemove: (item: VideoItem) => AsyncMaybe;
  onMergeSelected: (videoIds: string[]) => AsyncMaybe;
  onSaveSelected: (videoIds: string[]) => AsyncMaybe;
  selectedVideoIds: string[];
  onToggleSelection: (videoId: string) => void;
  refreshingMap: Record<string, boolean>;
  previewState: SidebarPreviewState;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  loading?: boolean;
  className?: string;
}

const VideoSidebar = ({
  items,
  thumbnails,
  onDownloadAll,
  downloadingAll,
  onDownload,
  onPlayPreview,
  onRemix,
  onAddShot,
  onRetry,
  onRefresh,
  onRemove,
  onMergeSelected,
  onSaveSelected,
  selectedVideoIds,
  onToggleSelection,
  refreshingMap,
  previewState,
  isMobileOpen,
  onMobileClose,
  loading = false,
  className = "",
}: VideoSidebarProps) => {
  const hasDownloadable = useMemo(
    () =>
      items.some(
        (item) => item?.id && isCompletedStatus(item.status) && !item.downloaded,
      ),
    [items],
  );

  const downloadHint = downloadingAll
    ? "Downloading completed videos…"
    : "Downloads may expire after one hour.";

  const resolveThumbnail = (item: VideoItem) => {
    if (item?.id && thumbnails[item.id]) return thumbnails[item.id];
    if (typeof (item as Record<string, unknown>).thumbnail_url === "string") {
      return (item as Record<string, string>).thumbnail_url;
    }
    return undefined;
  };

  const previewKeyForItem = (item: VideoItem) =>
    item.download_url ||
    item.id ||
    (item as { libraryDocumentId?: string }).libraryDocumentId ||
    "";

  const renderSkeletons = () => (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-[180px] rounded-2xl border border-border/60 bg-muted/60 p-4"
        >
          <div className="flex h-full w-full animate-pulse flex-col gap-4">
            <div className="h-[90px] rounded-xl bg-muted" />
            <div className="space-y-2">
              <div className="h-3 w-3/4 rounded-full bg-muted" />
              <div className="h-3 w-1/2 rounded-full bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <aside
      className={cn(
        "flex w-full flex-col rounded-[32px] border border-border/70 bg-card shadow-[0_25px_65px_rgba(15,23,42,0.08)]",
        className,
        isMobileOpen ? "fixed inset-0 z-50 m-4" : "hidden lg:flex",
        "lg:sticky lg:top-6 lg:m-0 lg:w-[480px] lg:h-[calc(100vh-3rem)]",
      )}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-5">
          <div className="flex flex-col gap-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Library
            </div>
            <div className="text-xl font-semibold text-foreground">
              Your generations
            </div>
            <div className="text-xs text-muted-foreground">{downloadHint}</div>
          </div>
          <div className="flex items-center gap-2">
            {selectedVideoIds.length >= 2 && (
              <Button
                size="sm"
                variant="default"
                onClick={() => onMergeSelected(selectedVideoIds)}
                className="rounded-full whitespace-nowrap"
              >
                <Merge className="h-4 w-4" />
                Merge ({selectedVideoIds.length})
              </Button>
            )}
            <Button
              size="sm"
              variant="default"
              onClick={() => onSaveSelected(selectedVideoIds)}
              className="rounded-full whitespace-nowrap"
              disabled={selectedVideoIds.length === 0}
            >
              <Save className="h-4 w-4" />
              {selectedVideoIds.length > 0
                ? `Save (${selectedVideoIds.length})`
                : "Select videos to save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onMobileClose}
              className="-mr-1 text-muted-foreground hover:text-foreground lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40 px-4 py-4">
          {loading ? (
            renderSkeletons()
          ) : items.length === 0 ? (
            <div className="flex h-full items-center justify-center px-2 py-6">
              <Empty className="max-w-sm border-none bg-transparent shadow-none">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PlayCircle className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyTitle>No videos generated yet</EmptyTitle>
                  <EmptyDescription>
                    Start by generating videos to see them appear in your library.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item, index) => {
                const isSelectable = Boolean(item.id && isCompletedStatus(item.status));
                const isSelected = item.id ? selectedVideoIds.includes(item.id) : false;

                return (
                  <div key={item.id || `library-${index}`} className="relative">
                    {isSelectable && (
                      <div className="absolute left-2 top-2 z-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => item.id && onToggleSelection(item.id)}
                          className="h-5 w-5 cursor-pointer rounded border-2 border-border bg-card checked:bg-primary checked:border-primary"
                          aria-label={`Select ${item.title || item.id}`}
                        />
                      </div>
                    )}
                    <VideoCard
                      item={item}
                      thumbnailUrl={resolveThumbnail(item)}
                      onDownload={onDownload}
                      onPlayPreview={onPlayPreview}
                      onRemix={onRemix}
                      onAddShot={onAddShot}
                      onRetry={onRetry}
                      onRefresh={onRefresh}
                      onRemove={onRemove}
                      isRefreshing={Boolean(item.id ? refreshingMap[item.id] : false)}
                      isPreviewing={
                        previewState.previewingId === previewKeyForItem(item)
                      }
                      previewLoading={previewState.previewLoading}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default VideoSidebar;

