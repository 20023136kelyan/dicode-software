import admin from "firebase-admin";
import { randomUUID } from "node:crypto";

let app: admin.app.App | null = null;

const getPrivateKey = () => {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  return key ? key.replace(/\\n/g, "\n") : undefined;
};

const ensureApp = (): admin.app.App => {
  if (app) return app;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  console.info("[firebaseAdmin] Env status", {
    hasProjectId: Boolean(projectId),
    hasClientEmail: Boolean(clientEmail),
    hasPrivateKey: Boolean(privateKey),
    hasStorageBucket: Boolean(storageBucket),
    mode: process.env.NODE_ENV,
  });

  const existingApp = admin.apps[0];

  if (projectId && clientEmail && privateKey) {
    if (existingApp) {
      app = existingApp;
      console.info("[firebaseAdmin] Reusing existing Firebase admin app");
    } else {
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        storageBucket,
      });
      console.info("[firebaseAdmin] Initialized admin SDK with cert credentials");
    }
  } else if (existingApp) {
    app = existingApp;
    console.warn("[firebaseAdmin] Falling back to existing default Firebase app");
  } else {
    app = admin.initializeApp();
    console.warn(
      "[firebaseAdmin] Initialized admin SDK with default credentials. Firebase token verification will fail if GOOGLE_CLOUD_PROJECT or service account env vars are missing.",
    );
  }

  return app!;
};

export const getFirestore = () => ensureApp().firestore();
export const getAuth = () => ensureApp().auth();
export const getStorageBucket = () => ensureApp().storage().bucket();

export async function verifyAuthHeader(
  authorization?: string | null,
): Promise<admin.auth.DecodedIdToken | null> {
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded;
  } catch (error) {
    console.warn("⚠️  Failed to verify Firebase token", error);
    return null;
  }
}

export interface UploadVideoParams {
  buffer: Buffer;
  contentType?: string;
  storagePath: string;
  metadata?: Record<string, unknown>;
}

export async function uploadVideoToStorage({
  buffer,
  contentType = "video/mp4",
  storagePath,
  metadata = {},
}: UploadVideoParams) {
  const bucket = getStorageBucket();
  const file = bucket.file(storagePath);
  const downloadToken = randomUUID();

  await file.save(buffer, {
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        ...metadata,
      },
    },
    resumable: false,
    public: false,
  });

  const encodedPath = encodeURIComponent(storagePath);
  const bucketName = bucket.name;
  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

  return {
    storagePath,
    downloadUrl,
    downloadToken,
  };
}

export interface SaveVideoDocParams {
  userId: string;
  title: string;
  description?: string;
  storageUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  tags?: string[];
  generationData?: Record<string, unknown>;
}

// Helper to recursively find and log undefined values
function findUndefinedPaths(obj: any, path: string = '', found: string[] = []): string[] {
  if (obj === undefined) {
    found.push(path);
    return found;
  }
  
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => findUndefinedPaths(v, `${path}[${i}]`, found));
  } else if (obj !== null && typeof obj === 'object') {
    // Skip Firestore sentinel values like serverTimestamp
    if (obj.constructor && obj.constructor.name === 'FieldValue') return found;
    
    Object.keys(obj).forEach(key => {
      const nextPath = path ? `${path}.${key}` : key;
      findUndefinedPaths(obj[key], nextPath, found);
    });
  }
  return found;
}

// Helper to remove undefined values recursively
function removeUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => removeUndefined(v));
  } else if (obj !== null && typeof obj === 'object') {
    // Skip Firestore sentinel values
    if (obj.constructor && obj.constructor.name === 'FieldValue') return obj;

    return Object.keys(obj).reduce((acc, key) => {
      const value = removeUndefined(obj[key]);
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
  }
  return obj;
}

export async function saveVideoDocument({
  userId,
  title,
  description,
  storageUrl,
  thumbnailUrl,
  duration,
  tags = [],
  generationData = {},
}: SaveVideoDocParams) {
  const firestore = getFirestore();

  // Construct the object exactly as we intend to save it
  // Note: We are NOT using defaults here yet so we can catch what's missing
  const dataToSave = {
    title,
    description,
    storageUrl,
    thumbnailUrl,
    source: "generated",
    duration,
    generationData,
    metadata: {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
      tags,
    },
  };

  // Check for undefined values
  const undefinedPaths = findUndefinedPaths(dataToSave);
  if (undefinedPaths.length > 0) {
    console.error("❌ Invalid data passed to saveVideoDocument. The following fields are undefined:", undefinedPaths);
    console.error("Full payload:", JSON.stringify(dataToSave, null, 2));
    
    // We can decide here: Throw error if critical fields are missing?
    // Critical fields: userId, storageUrl. (Title usually has a default in UI but let's be safe)
    const criticalFields = ['storageUrl', 'metadata.createdBy'];
    const missingCritical = undefinedPaths.filter(p => criticalFields.includes(p));
    
    if (missingCritical.length > 0) {
      throw new Error(`Missing critical fields for video save: ${missingCritical.join(', ')}`);
    }
    
    // For non-critical fields, we can log a warning and then proceed with sanitization
    console.warn("⚠️ Saving video with some undefined optional fields removed.");
  }
  
  // Apply defaults for optional top-level fields if they are missing (to avoid them being stripped entirely)
  const finalData = {
    ...dataToSave,
    title: title || "Untitled Video", // Ensure title exists
    description: description || "",
    tags: tags || [],
    // For generationData, we just strip undefineds as it's unstructured
  };

  const sanitizedData = removeUndefined(finalData);

  const docRef = await firestore.collection("videos").add(sanitizedData);

  return docRef.id;
}
