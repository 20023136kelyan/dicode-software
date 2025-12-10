import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,
    UploadTaskSnapshot,
    UploadMetadata,
} from 'firebase/storage';
import { storage } from './firebase';

/**
 * Upload a user avatar to Firebase Storage
 * @param file - The image file to upload
 * @param userId - The user ID
 * @param onProgress - Callback for upload progress (0-100)
 * @returns Download URL of the uploaded avatar
 */
export async function uploadAvatar(
    file: File,
    userId: string,
    onProgress?: (progress: number) => void
): Promise<string> {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        throw new Error('Image must be less than 5MB');
    }

    const extension = file.name.split('.').pop() || 'jpg';
    const path = `avatars/${userId}/avatar_${Date.now()}.${extension}`;
    const storageRef = ref(storage, path);

    const metadata: UploadMetadata = {
        contentType: file.type,
        customMetadata: {
            uploadedBy: userId,
            uploadedAt: new Date().toISOString(),
        },
    };

    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

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
