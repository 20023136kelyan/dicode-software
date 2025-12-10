'use client';

import { useState, useEffect, useRef } from 'react';
import { Film } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoThumbnailProps {
  src: string;
  className?: string;
  showControls?: boolean;
}

/**
 * A video thumbnail component that reliably shows a preview frame.
 * Handles loading, seeking, and fallback states properly.
 */
export function VideoThumbnail({ src, className, showControls = false }: VideoThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset state when src changes
    setIsLoaded(false);
    setHasError(false);

    const handleLoadedData = () => {
      // Video has enough data to show at least one frame
      // Seek to 25% of duration (or 1 second, whichever is smaller)
      const seekTime = Math.min(video.duration * 0.25, 1);
      video.currentTime = Math.max(0.1, seekTime);
    };

    const handleSeeked = () => {
      // Frame should be ready now
      setIsLoaded(true);
    };

    const handleError = () => {
      setHasError(true);
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    // If video is already loaded (cached), trigger manually
    if (video.readyState >= 2) {
      handleLoadedData();
    }

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };
  }, [src]);

  if (hasError) {
    return (
      <div className={cn('flex items-center justify-center bg-slate-100 overflow-hidden', className)}>
        <Film className="h-6 w-6 text-slate-400" />
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Loading placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <div className="h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <video
        ref={videoRef}
        src={src}
        className={cn(
          'w-full h-full object-cover transition-opacity duration-200',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
        muted
        playsInline
        preload="auto"
        controls={showControls}
      />
    </div>
  );
}

export default VideoThumbnail;

