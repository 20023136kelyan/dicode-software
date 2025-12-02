import { GenerationResult, ShotData } from './types';
import { downloadVideoFromBackend, uploadVideoBlob, generateVideoPath } from './storage';
import { createVideo, logActivity } from './firestore';

export interface SaveVideoProgress {
  stage: 'downloading' | 'uploading' | 'saving_metadata' | 'complete';
  shotNumber?: number;
  totalShots: number;
  progress: number;
  message: string;
}

export interface SaveVideoOptions {
  userId: string;
  userEmail?: string;
  userName?: string;
  result: GenerationResult;
  shots: ShotData[];
  quality: string;
  model: string;
  onProgress?: (progress: SaveVideoProgress) => void;
}

/**
 * Save generated video shots to Firebase Storage and Firestore
 * Downloads from backend, uploads to Firebase, and creates database records
 */
export async function saveGeneratedVideos(options: SaveVideoOptions): Promise<string[]> {
  const { userId, userEmail, userName, result, shots, quality, model, onProgress } = options;
  const { sequence_id, video_ids } = result;

  if (!sequence_id || !video_ids || video_ids.length === 0) {
    throw new Error('Invalid generation result: missing sequence_id or video_ids');
  }

  const savedVideoIds: string[] = [];
  const totalShots = video_ids.length;

  try {
    // Process each shot
    for (let i = 0; i < video_ids.length; i++) {
      const shotNumber = i + 1;
      const videoId = video_ids[i];
      const shotData = shots[i];

      // Stage 1: Download from backend
      onProgress?.({
        stage: 'downloading',
        shotNumber,
        totalShots,
        progress: (i / totalShots) * 100,
        message: `Downloading Shot ${shotNumber}...`,
      });

      const videoBlob = await downloadVideoFromBackend(sequence_id, shotNumber);

      // Stage 2: Upload to Firebase Storage
      onProgress?.({
        stage: 'uploading',
        shotNumber,
        totalShots,
        progress: ((i + 0.5) / totalShots) * 100,
        message: `Uploading Shot ${shotNumber} to Firebase...`,
      });

      const storagePath = generateVideoPath(
        userId,
        `generated_${sequence_id}_shot_${shotNumber}.mp4`
      );

      const downloadUrl = await uploadVideoBlob(videoBlob, storagePath, {
        contentType: videoBlob.type || 'video/mp4',
      });

      // Stage 3: Save metadata to Firestore
      onProgress?.({
        stage: 'saving_metadata',
        shotNumber,
        totalShots,
        progress: ((i + 0.75) / totalShots) * 100,
        message: `Saving Shot ${shotNumber} metadata...`,
      });

      // Create title based on shot data
      const title = generateVideoTitle(shotData, shotNumber, shots.length);
      const description = generateVideoDescription(shotData);

      const firestoreVideoId = await createVideo(userId, {
        title,
        description,
        storageUrl: downloadUrl,
        source: 'generated',
        generationData: {
          shots: [shotData],
          quality,
          model,
          sequenceId: sequence_id,
        },
        tags: ['generated', `shot-${shotNumber}`, model, quality],
      });

      savedVideoIds.push(firestoreVideoId);

      // Log activity for each generated video
      if (userEmail) {
        await logActivity({
          action: 'video_generated',
          userId,
          userEmail,
          userName,
          resourceId: firestoreVideoId,
          resourceName: title,
          resourceType: 'video',
          metadata: { model, quality, shotNumber, totalShots },
        });
      }
    }

    // Complete
    onProgress?.({
      stage: 'complete',
      totalShots,
      progress: 100,
      message: `Successfully saved ${totalShots} video${totalShots > 1 ? 's' : ''} to your library!`,
    });

    return savedVideoIds;
  } catch (error) {
    console.error('Error saving generated videos:', error);
    throw error;
  }
}

/**
 * Generate a descriptive title for a video shot
 */
function generateVideoTitle(shot: ShotData, shotNumber: number, totalShots: number): string {
  const shotPrefix = totalShots > 1 ? `Shot ${shotNumber}: ` : '';

  // Use dialog as the primary title component
  const dialogPreview = shot.dialog.substring(0, 50);
  const title = dialogPreview.length < shot.dialog.length
    ? `${dialogPreview}...`
    : dialogPreview;

  return `${shotPrefix}${title}`;
}

/**
 * Generate a detailed description for a video shot
 */
function generateVideoDescription(shot: ShotData): string {
  const parts: string[] = [];

  if (shot.character) {
    parts.push(`Character: ${shot.character}`);
  }

  if (shot.environment) {
    parts.push(`Environment: ${shot.environment}`);
  }

  if (shot.lighting) {
    parts.push(`Lighting: ${shot.lighting}`);
  }

  if (shot.camera) {
    parts.push(`Camera: ${shot.camera}`);
  }

  parts.push(`Dialog: ${shot.dialog}`);

  return parts.join('\n');
}
