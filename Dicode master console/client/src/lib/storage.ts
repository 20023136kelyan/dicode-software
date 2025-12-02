import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot,
  UploadMetadata,
} from 'firebase/storage';
import { storage } from './firebase';
import { getDownloadUrl } from './api';

/**
 * Upload a video file to Firebase Storage
 * @param file - The video file to upload
 * @param path - The storage path (e.g., 'videos/user123/video.mp4')
 * @param onProgress - Callback for upload progress (0-100)
 * @returns Download URL of the uploaded file
 */
export async function uploadVideo(
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      (error) => {
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
}

/**
 * Upload a video blob to Firebase Storage
 * @param blob - The video blob to upload
 * @param path - The storage path
 * @param onProgress - Callback for upload progress (0-100)
 * @returns Download URL of the uploaded file
 */
export async function uploadVideoBlob(
  blob: Blob,
  path: string,
  metadata?: UploadMetadata,
  onProgress?: (progress: number) => void
): Promise<string> {
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      (error) => {
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
}

/**
 * Download a video from the backend server as a blob
 * @param sequenceId - The sequence ID from generation
 * @param shotNumber - The shot number (1, 2, 3)
 * @returns Video blob
 */
export async function downloadVideoFromBackend(
  sequenceId: string,
  shotNumber: number
): Promise<Blob> {
  const url = getDownloadUrl(sequenceId, shotNumber);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`);
  }

  return await response.blob();
}

/**
 * Delete a video from Firebase Storage
 * @param path - The storage path of the video to delete
 */
export async function deleteVideo(path: string): Promise<void> {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}

/**
 * Generate a unique storage path for a video
 * @param userId - The user ID
 * @param filename - Original filename
 * @returns Unique storage path
 */
export function generateVideoPath(userId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `videos/${userId}/${timestamp}_${sanitizedFilename}`;
}
