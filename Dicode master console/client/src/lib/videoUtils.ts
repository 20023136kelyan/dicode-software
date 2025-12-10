/**
 * Video utility functions for thumbnail extraction and video processing
 */

/**
 * Extracts a thumbnail image from a video blob
 * @param videoBlob - The video file as a Blob
 * @param timeInSeconds - Time offset to extract frame from (default: 2 seconds or 25% of duration)
 * @returns Promise resolving to a JPEG thumbnail blob
 */
export async function extractThumbnail(
  videoBlob: Blob,
  timeInSeconds?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    video.preload = 'auto'; // Load more data to ensure frames are available
    video.muted = true; // Mute to avoid audio playback
    video.playsInline = true; // Important for iOS
    video.crossOrigin = 'anonymous'; // Help with CORS if needed
    video.src = URL.createObjectURL(videoBlob);

    let hasResolved = false;

    const captureFrame = () => {
      if (hasResolved) return;
      hasResolved = true;

      try {
        // Draw the video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Pause the video
        video.pause();

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            // Clean up object URL
            URL.revokeObjectURL(video.src);

            if (blob) {
              console.log('✅ Thumbnail extracted:', {
                size: `${(blob.size / 1024).toFixed(2)} KB`,
                dimensions: `${canvas.width}x${canvas.height}`,
                captureTime: `${video.currentTime.toFixed(2)}s`,
              });
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          },
          'image/jpeg',
          0.85 // JPEG quality (0-1)
        );
      } catch (error) {
        URL.revokeObjectURL(video.src);
        reject(error);
      }
    };

    // Wait for metadata to load first
    video.onloadedmetadata = () => {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Calculate optimal capture time
      let seekTime: number;
      if (timeInSeconds !== undefined) {
        seekTime = timeInSeconds;
      } else {
        // Smart default: 25% of duration, capped between 1s and 5s
        seekTime = Math.min(Math.max(video.duration * 0.25, 1), 5);
      }
      // Ensure we don't exceed duration
      seekTime = Math.min(seekTime, Math.max(0, video.duration - 0.5));
      seekTime = Math.max(0.1, seekTime); // At least 0.1s in

      console.log(`🎬 Seeking to ${seekTime.toFixed(2)}s for thumbnail (duration: ${video.duration.toFixed(2)}s)`);

      // Seek to the desired time
      video.currentTime = seekTime;
    };

    // After seeking, we need to ensure the frame is actually decoded
    // The most reliable way is to briefly play then capture on the next frame
    video.onseeked = () => {
      // Wait for canplay to ensure frame data is ready
      if (video.readyState >= 3) {
        // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA - frame should be ready
        // Use requestAnimationFrame to ensure the frame is painted
        requestAnimationFrame(() => {
          // Double RAF for extra safety - ensures frame is fully decoded
          requestAnimationFrame(() => {
            captureFrame();
          });
        });
      } else {
        // Not enough data yet, wait for canplay
        video.oncanplay = () => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              captureFrame();
            });
          });
        };
        // Also try playing briefly to force decode
        video.play().catch(() => {
          // Play might fail due to autoplay policies, but seek should still work
        });
      }
    };

    video.onerror = (e) => {
      if (hasResolved) return;
      hasResolved = true;
      URL.revokeObjectURL(video.src);
      console.error('❌ Failed to load video for thumbnail extraction:', e);
      reject(new Error('Failed to load video for thumbnail extraction'));
    };

    // Timeout fallback - if nothing happens in 10s, fail gracefully
    setTimeout(() => {
      if (hasResolved) return;
      hasResolved = true;
      URL.revokeObjectURL(video.src);
      reject(new Error('Thumbnail extraction timed out'));
    }, 10000);
  });
}

/**
 * Gets video duration from a blob
 * @param videoBlob - The video file as a Blob
 * @returns Promise resolving to duration in seconds
 */
export async function getVideoDuration(videoBlob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(videoBlob);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = (e) => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to get video duration'));
    };
  });
}
