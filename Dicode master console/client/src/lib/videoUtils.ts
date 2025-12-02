/**
 * Video utility functions for thumbnail extraction and video processing
 */

/**
 * Extracts a thumbnail image from a video blob
 * @param videoBlob - The video file as a Blob
 * @param timeInSeconds - Time offset to extract frame from (default: 1 second)
 * @returns Promise resolving to a JPEG thumbnail blob
 */
export async function extractThumbnail(
  videoBlob: Blob,
  timeInSeconds: number = 1
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    video.preload = 'metadata';
    video.muted = true; // Mute to avoid audio playback
    video.playsInline = true; // Important for iOS
    video.src = URL.createObjectURL(videoBlob);

    // Wait for metadata to load first
    video.onloadedmetadata = () => {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Seek to the desired time (triggers 'seeked' event)
      video.currentTime = Math.min(timeInSeconds, video.duration - 0.1);
    };

    // Draw frame after seeking completes
    video.onseeked = () => {
      try {
        // Draw the video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            // Clean up object URL
            URL.revokeObjectURL(video.src);

            if (blob) {
              console.log('✅ Thumbnail extracted:', {
                size: `${(blob.size / 1024).toFixed(2)} KB`,
                dimensions: `${canvas.width}x${canvas.height}`,
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

    video.onerror = (e) => {
      URL.revokeObjectURL(video.src);
      console.error('❌ Failed to load video for thumbnail extraction:', e);
      reject(new Error('Failed to load video for thumbnail extraction'));
    };
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
