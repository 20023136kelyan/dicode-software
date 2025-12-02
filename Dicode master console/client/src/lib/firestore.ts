import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
  writeBatch,
  documentId,
  increment,
  arrayUnion,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Campaign,
  CampaignDoc,
  CampaignItem,
  Video,
  Asset,
  AssetPromptMetadata,
  AssetType,
  Question,
  CampaignEnrollment,
  CampaignProgress,
  CampaignResponse,
  Activity,
  AppNotification,
} from './types';
import { CompetencyDefinition, SkillDefinition } from './competencies';

// Collections
const CAMPAIGNS_COLLECTION = 'campaigns';
const CAMPAIGN_ITEMS_COLLECTION = 'campaignItems';
const CAMPAIGN_ENROLLMENTS_COLLECTION = 'campaignEnrollments';
const CAMPAIGN_PROGRESS_COLLECTION = 'campaignProgress';
const CAMPAIGN_RESPONSES_COLLECTION = 'campaignResponses';
const VIDEOS_COLLECTION = 'videos';
const ASSETS_COLLECTION = 'assets';
const ACTIVITIES_COLLECTION = 'activities';
const NOTIFICATIONS_COLLECTION = 'notifications';
const COMPETENCIES_COLLECTION = 'competencies';

// Logging helper
function logFirestoreOperation(operation: string, collection: string, details?: any) {
  console.log(`🔥 Firestore ${operation}:`, {
    collection,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

// Helper to convert Firestore timestamp to Date
function timestampToDate(timestamp: any): Date {
  if (!timestamp) {
    return new Date(0);
  }
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  return new Date(timestamp);
}

function normalizeAssetDocument(docSnap: any): Asset {
  const data = docSnap.data?.() ?? docSnap.data ?? {};
  const metadata = data?.metadata ?? {};
  const type = (data?.type as AssetType) ?? 'character';

  const createdAt = timestampToDate(metadata.createdAt);
  const updatedAt = timestampToDate(metadata.updatedAt);
  const lastUsedAt = metadata.lastUsedAt ? timestampToDate(metadata.lastUsedAt) : undefined;

  return {
    id: docSnap.id,
    type,
    name: data?.name ?? 'Untitled Asset',
    description: data?.description ?? '',
    promptMetadata: data?.promptMetadata as AssetPromptMetadata | undefined,
    metadata: {
      createdAt,
      updatedAt,
      createdBy: metadata.createdBy ?? '',
      tags: metadata.tags ?? [],
      usageCount: typeof metadata.usageCount === 'number' ? metadata.usageCount : 0,
      promptSchemaVersion: metadata.promptSchemaVersion,
      lastUsedAt,
      pinned: metadata.pinned,
    },
  };
}

// Campaign CRUD Operations

export async function createCampaign(
  userId: string,
  data: {
    title: string;
    description: string;
    skillFocus: string;
    tags?: string[];
    allowedOrganizations?: string[];
    selectedSkills?: Record<string, string[]>;
    anonymousResponses?: boolean;
    schedule?: {
      startDate: string;
      endDate: string;
      frequency: 'once' | 'weekly' | 'monthly' | 'quarterly';
    };
    automation?: {
      autoSendInvites: boolean;
      sendReminders: boolean;
      sendConfirmations: boolean;
    };
  }
): Promise<string> {
  const campaignDoc: Omit<CampaignDoc, 'id'> = {
    title: data.title,
    description: data.description,
    skillFocus: data.skillFocus,
    itemIds: [],
    source: 'dicode', // Campaigns created in Workspace are DiCode campaigns
    anonymousResponses: data.anonymousResponses ?? true,
    ...(data.allowedOrganizations && data.allowedOrganizations.length > 0
      ? { allowedOrganizations: data.allowedOrganizations }
      : {}),
    ...(data.selectedSkills ? { selectedSkills: data.selectedSkills } : {}),
    ...(data.schedule ? { schedule: data.schedule } : {}),
    ...(data.automation ? { automation: data.automation } : {}),
    metadata: {
      createdAt: Timestamp.now() as any,
      updatedAt: Timestamp.now() as any,
      createdBy: userId,
      version: 1,
      isPublished: false,
      tags: data.tags || [],
    },
  };

  const docRef = await addDoc(collection(db, CAMPAIGNS_COLLECTION), campaignDoc);
  return docRef.id;
}

export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data() as CampaignDoc;

  // Fetch all campaign items using batch read (optimized)
  const items = await batchGetCampaignItems(data.itemIds);

  return {
    id: docSnap.id,
    title: data.title,
    description: data.description,
    skillFocus: data.skillFocus,
    items: items.sort((a, b) => a.order - b.order),
    allowedOrganizations: data.allowedOrganizations,
    selectedSkills: data.selectedSkills,
    schedule: data.schedule,
    automation: data.automation,
    anonymousResponses: data.anonymousResponses,
    metadata: {
      ...data.metadata,
      createdAt: timestampToDate(data.metadata.createdAt),
      updatedAt: timestampToDate(data.metadata.updatedAt),
    },
  };
}

export async function getCampaignsByUser(userId: string): Promise<Campaign[]> {
  const q = query(
    collection(db, CAMPAIGNS_COLLECTION),
    where('metadata.createdBy', '==', userId),
    orderBy('metadata.updatedAt', 'desc')
  );

  const querySnapshot = await getDocs(q);
  const campaigns: Campaign[] = [];

  for (const docSnap of querySnapshot.docs) {
    const campaign = await getCampaign(docSnap.id);
    if (campaign) {
      campaigns.push(campaign);
    }
  }

  return campaigns;
}

export async function updateCampaign(
  campaignId: string,
  data: Partial<Omit<CampaignDoc, 'id' | 'metadata'>> & { tags?: string[] }
): Promise<void> {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);

  // Extract tags if present to put into metadata
  const { tags, ...campaignData } = data;

  const updateData: any = {
    ...campaignData,
    'metadata.updatedAt': Timestamp.now(),
  };

  if (tags) {
    updateData['metadata.tags'] = tags;
  }

  await updateDoc(docRef, updateData);
}

export async function setCampaignPublishState(
  campaignId: string,
  isPublished: boolean
): Promise<void> {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  await updateDoc(docRef, {
    'metadata.isPublished': isPublished,
    'metadata.updatedAt': Timestamp.now(),
  });
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return;

  // Delete all campaign items using batch operation
  const itemIds = campaign.items.map(item => item.id);
  if (itemIds.length > 0) {
    await batchDeleteCampaignItems(campaignId, itemIds);
  }

  // Delete campaign document
  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  await deleteDoc(docRef);
}

// Campaign Item CRUD Operations

/**
 * Batch read multiple campaign items in a single query
 * Much more efficient than reading items one by one
 */
export async function batchGetCampaignItems(itemIds: string[]): Promise<CampaignItem[]> {
  if (itemIds.length === 0) return [];

  // Firestore 'in' queries are limited to 10 items, so we need to batch
  const BATCH_SIZE = 10;
  const batches: string[][] = [];

  for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
    batches.push(itemIds.slice(i, i + BATCH_SIZE));
  }

  const allItems: CampaignItem[] = [];

  for (const batch of batches) {
    const q = query(
      collection(db, CAMPAIGN_ITEMS_COLLECTION),
      where(documentId(), 'in', batch)
    );

    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Omit<CampaignItem, 'id'>;
      return {
        id: docSnap.id,
        ...data,
        metadata: {
          createdAt: timestampToDate(data.metadata.createdAt),
          updatedAt: timestampToDate(data.metadata.updatedAt),
        },
      };
    });

    allItems.push(...items);
  }

  // Preserve original order
  const itemMap = new Map(allItems.map(item => [item.id, item]));
  return itemIds.map(id => itemMap.get(id)).filter((item): item is CampaignItem => item !== undefined);
}

export async function createCampaignItem(
  campaignId: string,
  videoId: string,
  order: number,
  questions?: CampaignItem['questions'] // Optional for backward compatibility - questions now stored on Video
): Promise<string> {
  const itemDoc: Omit<CampaignItem, 'id'> = {
    campaignId,
    videoId,
    order,
    ...(questions ? { questions } : {}), // Only include questions if provided (for backward compatibility)
    metadata: {
      createdAt: Timestamp.now() as any,
      updatedAt: Timestamp.now() as any,
    },
  };

  const docRef = await addDoc(collection(db, CAMPAIGN_ITEMS_COLLECTION), itemDoc);

  // Update campaign's itemIds
  const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  const campaignSnap = await getDoc(campaignRef);
  if (campaignSnap.exists()) {
    await updateDoc(campaignRef, {
      itemIds: arrayUnion(docRef.id),
      'metadata.updatedAt': Timestamp.now(),
    });
  }

  return docRef.id;
}

export async function getCampaignItem(itemId: string): Promise<CampaignItem | null> {
  const docRef = doc(db, CAMPAIGN_ITEMS_COLLECTION, itemId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data() as Omit<CampaignItem, 'id'>;
  return {
    id: docSnap.id,
    ...data,
    metadata: {
      createdAt: timestampToDate(data.metadata.createdAt),
      updatedAt: timestampToDate(data.metadata.updatedAt),
    },
  };
}

export async function updateCampaignItem(
  itemId: string,
  data: Partial<Omit<CampaignItem, 'id' | 'metadata'>>
): Promise<void> {
  const docRef = doc(db, CAMPAIGN_ITEMS_COLLECTION, itemId);
  await updateDoc(docRef, {
    ...data,
    'metadata.updatedAt': Timestamp.now(),
  });
}

export async function deleteCampaignItem(itemId: string): Promise<void> {
  const item = await getCampaignItem(itemId);
  if (!item) return;

  // Remove from campaign's itemIds
  const campaignRef = doc(db, CAMPAIGNS_COLLECTION, item.campaignId);
  const campaignSnap = await getDoc(campaignRef);
  if (campaignSnap.exists()) {
    const campaignData = campaignSnap.data() as CampaignDoc;
    await updateDoc(campaignRef, {
      itemIds: campaignData.itemIds.filter((id) => id !== itemId),
      'metadata.updatedAt': Timestamp.now(),
    });
  }

  // Delete item document
  const docRef = doc(db, CAMPAIGN_ITEMS_COLLECTION, itemId);
  await deleteDoc(docRef);
}

/**
 * Batch delete multiple campaign items atomically
 * More efficient than deleting items one by one
 */
export async function batchDeleteCampaignItems(
  campaignId: string,
  itemIds: string[]
): Promise<void> {
  if (itemIds.length === 0) return;

  const batch = writeBatch(db);

  // Get campaign document to update itemIds array
  const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  const campaignSnap = await getDoc(campaignRef);

  if (campaignSnap.exists()) {
    const campaignData = campaignSnap.data() as CampaignDoc;
    // Remove all deleted item IDs from campaign's itemIds array
    const updatedItemIds = campaignData.itemIds.filter(
      (id) => !itemIds.includes(id)
    );

    batch.update(campaignRef, {
      itemIds: updatedItemIds,
      'metadata.updatedAt': Timestamp.now(),
    });
  }

  // Delete all item documents
  itemIds.forEach((itemId) => {
    const itemRef = doc(db, CAMPAIGN_ITEMS_COLLECTION, itemId);
    batch.delete(itemRef);
  });

  // Commit all changes atomically
  await batch.commit();
}

// Video CRUD Operations

export async function createVideo(
  userId: string,
  data: {
    title: string;
    description?: string;
    storageUrl: string;
    thumbnailUrl?: string;
    source: Video['source'];
    duration?: number;
    questions?: Question[]; // Questions attached to this video
    generationData?: Video['generationData'];
    tags?: string[];
  }
): Promise<string> {
  logFirestoreOperation('CREATE', VIDEOS_COLLECTION, {
    userId,
    title: data.title,
    source: data.source,
    hasQuestions: !!data.questions,
    questionCount: data.questions?.length || 0,
    tags: data.tags,
  });

  const videoDoc: Omit<Video, 'id'> = {
    title: data.title,
    ...(data.description !== undefined ? { description: data.description } : {}),
    storageUrl: data.storageUrl,
    ...(data.thumbnailUrl !== undefined ? { thumbnailUrl: data.thumbnailUrl } : {}),
    source: data.source,
    ...(data.duration !== undefined ? { duration: data.duration } : {}),
    ...(data.questions !== undefined && data.questions.length > 0 ? { questions: data.questions } : {}),
    ...(data.generationData !== undefined ? { generationData: data.generationData } : {}),
    metadata: {
      createdAt: Timestamp.now() as any,
      updatedAt: Timestamp.now() as any,
      createdBy: userId,
      tags: data.tags || [],
    },
  } as Omit<Video, 'id'>;

  try {
    const docRef = await addDoc(collection(db, VIDEOS_COLLECTION), videoDoc);
    console.log('✅ Video created successfully:', docRef.id, data.questions ? `with ${data.questions.length} questions` : 'without questions');
    return docRef.id;
  } catch (error) {
    console.error('❌ Failed to create video:', error);
    throw error;
  }
}

export async function getVideo(videoId: string): Promise<Video | null> {
  const docRef = doc(db, VIDEOS_COLLECTION, videoId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data() as Omit<Video, 'id'>;
  return {
    id: docSnap.id,
    ...data,
    metadata: {
      ...data.metadata,
      createdAt: timestampToDate(data.metadata.createdAt),
      updatedAt: timestampToDate(data.metadata.updatedAt),
    },
  };
}

export async function getVideosByUser(userId: string): Promise<Video[]> {
  logFirestoreOperation('READ', VIDEOS_COLLECTION, { userId });

  const q = query(
    collection(db, VIDEOS_COLLECTION),
    where('metadata.createdBy', '==', userId),
    orderBy('metadata.createdAt', 'desc')
  );

  try {
    const querySnapshot = await getDocs(q);
    console.log(`✅ Found ${querySnapshot.docs.length} videos for user ${userId}`);

    return querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Omit<Video, 'id'>;
      return {
        id: docSnap.id,
        ...data,
        metadata: {
          ...data.metadata,
          createdAt: timestampToDate(data.metadata.createdAt),
          updatedAt: timestampToDate(data.metadata.updatedAt),
        },
      };
    });
  } catch (error) {
    console.error('❌ Failed to fetch videos:', error);
    throw error;
  }
}

export async function getAllVideos(): Promise<Video[]> {
  logFirestoreOperation('READ', VIDEOS_COLLECTION, { scope: 'all' });

  const q = query(
    collection(db, VIDEOS_COLLECTION),
    orderBy('metadata.createdAt', 'desc')
  );

  try {
    const querySnapshot = await getDocs(q);
    console.log(`✅ Found ${querySnapshot.docs.length} total videos`);

    return querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Omit<Video, 'id'>;
      return {
        id: docSnap.id,
        ...data,
        metadata: {
          ...data.metadata,
          createdAt: timestampToDate(data.metadata.createdAt),
          updatedAt: timestampToDate(data.metadata.updatedAt),
        },
      };
    });
  } catch (error) {
    console.error('❌ Failed to fetch all videos:', error);
    throw error;
  }
}

export async function updateVideo(
  videoId: string,
  data: Partial<Omit<Video, 'id' | 'metadata'>>
): Promise<void> {
  const docRef = doc(db, VIDEOS_COLLECTION, videoId);
  await updateDoc(docRef, {
    ...data,
    'metadata.updatedAt': Timestamp.now(),
  });
}

/**
 * Get all campaigns that use a specific video
 * Used to check referential integrity before deleting a video
 */
export async function getCampaignsByVideo(videoId: string): Promise<Campaign[]> {
  // First find all campaign items with this video
  const q = query(
    collection(db, CAMPAIGN_ITEMS_COLLECTION),
    where('videoId', '==', videoId)
  );

  const querySnapshot = await getDocs(q);
  const campaignIds = [...new Set(querySnapshot.docs.map(doc => doc.data().campaignId))];

  if (campaignIds.length === 0) return [];

  // Fetch full campaign details
  const campaigns: Campaign[] = [];
  for (const campaignId of campaignIds) {
    const campaign = await getCampaign(campaignId);
    if (campaign) {
      campaigns.push(campaign);
    }
  }

  return campaigns;
}

/**
 * Delete a video with optional force flag
 * If force is false (default), will throw error if video is used in campaigns
 * If force is true, will delete video even if used in campaigns (orphans campaign items)
 */
export async function deleteVideo(videoId: string, force = false): Promise<void> {
  // Check if video is used in any campaigns
  const campaigns = await getCampaignsByVideo(videoId);

  if (campaigns.length > 0 && !force) {
    const campaignTitles = campaigns.map(c => c.title).join(', ');
    throw new Error(
      `Cannot delete video: used in ${campaigns.length} campaign(s): ${campaignTitles}. ` +
      `Remove from campaigns first or use force=true.`
    );
  }

  const docRef = doc(db, VIDEOS_COLLECTION, videoId);
  await deleteDoc(docRef);

  console.log('✅ Video deleted:', videoId, force ? '(forced)' : '');
}

// Asset CRUD Operations

export async function createAsset(
  userId: string,
  data: {
    type: AssetType;
    name: string;
    description: string;
    tags?: string[];
    promptMetadata?: AssetPromptMetadata;
  }
): Promise<string> {
  const now = Timestamp.now();
  const metadata = {
    createdAt: now as any,
    updatedAt: now as any,
    createdBy: userId,
    tags: data.tags || [],
    usageCount: 0,
    ...(data.promptMetadata?.schemaVersion
      ? { promptSchemaVersion: data.promptMetadata.schemaVersion }
      : {}),
  };

  const assetDoc: Omit<Asset, 'id'> = {
    type: data.type,
    name: data.name,
    description: data.description,
    ...(data.promptMetadata ? { promptMetadata: data.promptMetadata } : {}),
    metadata,
  };

  const docRef = await addDoc(collection(db, ASSETS_COLLECTION), assetDoc);
  return docRef.id;
}

export async function getAsset(assetId: string): Promise<Asset | null> {
  const docRef = doc(db, ASSETS_COLLECTION, assetId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return normalizeAssetDocument(docSnap);
}

export async function getAssetsByUser(
  userId?: string,  // Now optional, kept for backward compatibility
  type?: AssetType
): Promise<Asset[]> {
  const constraints: QueryConstraint[] = [
    orderBy('metadata.createdAt', 'desc'),
  ];

  if (type) {
    constraints.unshift(where('type', '==', type));
  }

  const q = query(collection(db, ASSETS_COLLECTION), ...constraints);

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(normalizeAssetDocument);
}

export async function getRankedAssetsByUser(
  userId?: string,  // Now optional, kept for backward compatibility
  options: { limit?: number } = {}
): Promise<Asset[]> {
  const limitCount = options.limit ?? 48;

  const rankedConstraints: QueryConstraint[] = [
    orderBy('metadata.usageCount', 'desc'),
    orderBy('metadata.createdAt', 'desc'),
    limit(limitCount),
  ];

  try {
    const rankedQuery = query(collection(db, ASSETS_COLLECTION), ...rankedConstraints);
    const rankedSnapshot = await getDocs(rankedQuery);
    return rankedSnapshot.docs.map(normalizeAssetDocument);
  } catch (error) {
    console.warn('⚠️ Falling back to createdAt order for ranked assets', error);
    const fallback = await getAssetsByUser();
    return fallback.slice(0, limitCount);
  }
}

export async function updateAsset(
  assetId: string,
  data: Partial<Omit<Asset, 'id' | 'metadata'>>
): Promise<void> {
  const docRef = doc(db, ASSETS_COLLECTION, assetId);
  await updateDoc(docRef, {
    ...data,
    'metadata.updatedAt': Timestamp.now(),
  });
}

export async function deleteAsset(assetId: string): Promise<void> {
  const docRef = doc(db, ASSETS_COLLECTION, assetId);
  await deleteDoc(docRef);
}

export async function incrementAssetsUsage(
  assetIds: string[],
  options: { incrementBy?: number; lastUsedAt?: Date } = {}
): Promise<void> {
  if (!assetIds.length) {
    return;
  }

  const amount = options.incrementBy ?? 1;
  const now = Timestamp.now();
  const lastUsedAt = options.lastUsedAt
    ? Timestamp.fromDate(options.lastUsedAt)
    : now;

  const batch = writeBatch(db);

  assetIds.forEach((assetId) => {
    const assetRef = doc(db, ASSETS_COLLECTION, assetId);
    const payload: Record<string, unknown> = {
      'metadata.usageCount': increment(amount),
      'metadata.updatedAt': now,
      'metadata.lastUsedAt': lastUsedAt,
    };
    batch.update(assetRef, payload);
  });

  try {
    await batch.commit();
  } catch (error) {
    console.error('Failed to increment asset usage batch', error);
  }
}

export async function incrementAssetUsage(assetId: string, amount = 1): Promise<void> {
  await incrementAssetsUsage([assetId], { incrementBy: amount });
}

// Campaign Item Management Operations (Phase 2)

/**
 * Add an existing video to a campaign
 * Creates a new campaign item and updates campaign's itemIds
 */
export async function addVideoToCampaign(
  campaignId: string,
  videoId: string
): Promise<string> {
  // Get current campaign to determine next order
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  const nextOrder = campaign.items.length;

  // Create campaign item without questions (questions are on the video)
  return await createCampaignItem(campaignId, videoId, nextOrder);
}

/**
 * Remove a video from a campaign
 * Deletes the campaign item and reorders remaining items
 */
export async function removeVideoFromCampaign(
  campaignId: string,
  videoId: string
): Promise<void> {
  // Find the campaign item with this videoId
  const q = query(
    collection(db, CAMPAIGN_ITEMS_COLLECTION),
    where('campaignId', '==', campaignId),
    where('videoId', '==', videoId)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    console.warn(`No campaign item found for video ${videoId} in campaign ${campaignId}`);
    return;
  }

  // Delete the campaign item (this already updates campaign's itemIds)
  for (const docSnap of querySnapshot.docs) {
    await deleteCampaignItem(docSnap.id);
  }

  // Reorder remaining items
  const updatedCampaign = await getCampaign(campaignId);
  if (updatedCampaign) {
    await reorderCampaignItems(
      campaignId,
      updatedCampaign.items.map(item => item.id)
    );
  }
}

/**
 * Reorder campaign items
 * Updates the order field for all items based on the provided array
 */
export async function reorderCampaignItems(
  campaignId: string,
  orderedItemIds: string[]
): Promise<void> {
  const batch = writeBatch(db);

  orderedItemIds.forEach((itemId, index) => {
    const itemRef = doc(db, CAMPAIGN_ITEMS_COLLECTION, itemId);
    batch.update(itemRef, {
      order: index,
      'metadata.updatedAt': Timestamp.now(),
    });
  });

  // Update campaign's updatedAt
  const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  batch.update(campaignRef, {
    'metadata.updatedAt': Timestamp.now(),
  });

  await batch.commit();
  console.log('✅ Reordered campaign items:', orderedItemIds.length);
}

/**
 * Clean up orphaned campaign items
 * Finds campaign items whose videos no longer exist and removes them
 */
export async function cleanupOrphanedCampaignItems(campaignId: string): Promise<number> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return 0;

  const orphanedItemIds: string[] = [];

  // Check each campaign item
  for (const item of campaign.items) {
    const video = await getVideo(item.videoId);
    if (!video) {
      orphanedItemIds.push(item.id);
    }
  }

  // Delete orphaned items
  if (orphanedItemIds.length > 0) {
    await batchDeleteCampaignItems(campaignId, orphanedItemIds);
    console.log(`✅ Cleaned up ${orphanedItemIds.length} orphaned campaign items`);
  }

  return orphanedItemIds.length;
}

// Asset-Video Relationship Tracking

/**
 * Get all videos that use a specific asset
 * Searches for asset ID in video.generationData.usedAssets
 */
export async function getVideosByAsset(assetId: string, userId?: string): Promise<Video[]> {
  const constraints: QueryConstraint[] = [
    where('generationData.usedAssets', 'array-contains', assetId),
  ];

  if (userId) {
    constraints.push(where('metadata.createdBy', '==', userId));
  }

  const q = query(collection(db, VIDEOS_COLLECTION), ...constraints);

  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Omit<Video, 'id'>;
      return {
        id: docSnap.id,
        ...data,
        metadata: {
          ...data.metadata,
          createdAt: timestampToDate(data.metadata.createdAt),
          updatedAt: timestampToDate(data.metadata.updatedAt),
        },
      };
    });
  } catch (error) {
    console.error('❌ Failed to fetch videos by asset:', error);
    return [];
  }
}

// Campaign Enrollment Operations

export async function enrollUserInCampaign(
  campaignId: string,
  userId: string,
  organizationId: string,
  metadata: { enrolledBy?: string; autoEnrolled?: boolean } = {}
): Promise<string> {
  // Check if already enrolled
  const existing = await checkUserEnrollment(campaignId, userId);
  if (existing) {
    return existing.id!;
  }

  const enrollment: Omit<CampaignEnrollment, 'id'> = {
    campaignId,
    userId,
    organizationId,
    status: 'not-started',
    enrolledAt: Timestamp.now(),
    accessCount: 0,
    metadata,
  };

  const docRef = await addDoc(collection(db, CAMPAIGN_ENROLLMENTS_COLLECTION), enrollment);

  // Update campaign stats
  const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  await updateDoc(campaignRef, {
    'stats.totalEnrollments': increment(1),
    'stats.notStartedCount': increment(1),
  });

  return docRef.id;
}

export async function checkUserEnrollment(
  campaignId: string,
  userId: string
): Promise<CampaignEnrollment | null> {
  const q = query(
    collection(db, CAMPAIGN_ENROLLMENTS_COLLECTION),
    where('campaignId', '==', campaignId),
    where('userId', '==', userId),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const data = snapshot.docs[0].data();
  return {
    id: snapshot.docs[0].id,
    ...data,
    enrolledAt: timestampToDate(data.enrolledAt),
    completedAt: data.completedAt ? timestampToDate(data.completedAt) : undefined,
  } as CampaignEnrollment;
}

export async function getCampaignEnrollments(campaignId: string): Promise<CampaignEnrollment[]> {
  const q = query(
    collection(db, CAMPAIGN_ENROLLMENTS_COLLECTION),
    where('campaignId', '==', campaignId),
    orderBy('enrolledAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      enrolledAt: timestampToDate(data.enrolledAt),
      completedAt: data.completedAt ? timestampToDate(data.completedAt) : undefined,
    } as CampaignEnrollment;
  });
}

export async function getUserEnrollments(userId: string): Promise<CampaignEnrollment[]> {
  const q = query(
    collection(db, CAMPAIGN_ENROLLMENTS_COLLECTION),
    where('userId', '==', userId),
    orderBy('enrolledAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      enrolledAt: timestampToDate(data.enrolledAt),
      completedAt: data.completedAt ? timestampToDate(data.completedAt) : undefined,
    } as CampaignEnrollment;
  });
}

export async function updateEnrollmentAccess(enrollmentId: string): Promise<void> {
  const docRef = doc(db, CAMPAIGN_ENROLLMENTS_COLLECTION, enrollmentId);
  await updateDoc(docRef, {
    accessCount: increment(1),
    status: 'in-progress', // Auto-switch to in-progress on first access
  });
}

export async function markEnrollmentCompleted(enrollmentId: string): Promise<void> {
  const docRef = doc(db, CAMPAIGN_ENROLLMENTS_COLLECTION, enrollmentId);
  await updateDoc(docRef, {
    status: 'completed',
    completedAt: Timestamp.now(),
  });
}

// Campaign Progress Operations

export async function updateVideoProgress(
  campaignId: string,
  userId: string,
  videoId: string,
  data: {
    watchedDuration: number;
    totalDuration: number;
    completed: boolean;
  }
): Promise<void> {
  // Find existing progress doc
  const q = query(
    collection(db, CAMPAIGN_PROGRESS_COLLECTION),
    where('campaignId', '==', campaignId),
    where('userId', '==', userId),
    where('videoId', '==', videoId),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    // Create new progress
    await addDoc(collection(db, CAMPAIGN_PROGRESS_COLLECTION), {
      campaignId,
      userId,
      videoId,
      ...data,
      lastWatchedAt: Timestamp.now(),
      allQuestionsAnswered: false,
    });
  } else {
    // Update existing
    await updateDoc(snapshot.docs[0].ref, {
      ...data,
      lastWatchedAt: Timestamp.now(),
    });
  }
}

export async function updateQuestionProgress(
  campaignId: string,
  userId: string,
  videoId: string,
  questionId: string
): Promise<void> {
  // Find progress doc
  const q = query(
    collection(db, CAMPAIGN_PROGRESS_COLLECTION),
    where('campaignId', '==', campaignId),
    where('userId', '==', userId),
    where('videoId', '==', videoId),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const docRef = snapshot.docs[0].ref;
    const data = snapshot.docs[0].data();
    const questionsAnswered = data.questionsAnswered || [];

    if (!questionsAnswered.includes(questionId)) {
      await updateDoc(docRef, {
        questionsAnswered: [...questionsAnswered, questionId],
      });
    }
  }
}

export async function getCampaignProgress(
  campaignId: string,
  userId: string
): Promise<CampaignProgress[]> {
  const q = query(
    collection(db, CAMPAIGN_PROGRESS_COLLECTION),
    where('campaignId', '==', campaignId),
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      lastWatchedAt: timestampToDate(data.lastWatchedAt),
    } as CampaignProgress;
  });
}

export async function checkCampaignCompletion(
  campaignId: string,
  userId: string
): Promise<boolean> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return false;

  const progress = await getCampaignProgress(campaignId, userId);

  // Check if all items are completed
  const allItemsCompleted = campaign.items.every(item => {
    const itemProgress = progress.find(p => p.videoId === item.videoId);
    return itemProgress?.completed && itemProgress?.allQuestionsAnswered;
  });

  return allItemsCompleted;
}

// Campaign Response Operations

export async function saveCampaignResponse(
  campaignId: string,
  userId: string,
  videoId: string,
  questionId: string,
  answer: string | number
): Promise<void> {
  await addDoc(collection(db, CAMPAIGN_RESPONSES_COLLECTION), {
    campaignId,
    userId,
    videoId,
    questionId,
    answer,
    answeredAt: Timestamp.now(),
  });

  // Update progress to mark question as answered
  await updateQuestionProgress(campaignId, userId, videoId, questionId);
}

export async function getCampaignResponses(campaignId: string): Promise<CampaignResponse[]> {
  const q = query(
    collection(db, CAMPAIGN_RESPONSES_COLLECTION),
    where('campaignId', '==', campaignId),
    orderBy('answeredAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      answeredAt: timestampToDate(data.answeredAt),
    } as CampaignResponse;
  });
}

export async function getUserCampaignResponses(
  campaignId: string,
  userId: string
): Promise<CampaignResponse[]> {
  const q = query(
    collection(db, CAMPAIGN_RESPONSES_COLLECTION),
    where('campaignId', '==', campaignId),
    where('userId', '==', userId),
    orderBy('answeredAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      answeredAt: timestampToDate(data.answeredAt),
    } as CampaignResponse;
  });
}

// Activity Tracking Operations

// Map activity actions to notification details
function getNotificationDetailsFromActivity(activity: Omit<Activity, 'id' | 'createdAt'>): {
  type: AppNotification['type'];
  title: string;
  message: string;
  actionUrl?: string;
} | null {
  const actorName = activity.userName || activity.userEmail.split('@')[0];
  
  switch (activity.action) {
    case 'campaign_created':
      return {
        type: 'team_activity',
        title: 'New campaign created',
        message: `${actorName} created "${activity.resourceName}"`,
        actionUrl: '/campaigns',
      };
    case 'campaign_published':
      return {
        type: 'campaign_published',
        title: 'Campaign published',
        message: `${actorName} published "${activity.resourceName}"`,
        actionUrl: '/campaigns',
      };
    case 'campaign_updated':
      return {
        type: 'team_activity',
        title: 'Campaign updated',
        message: `${actorName} updated "${activity.resourceName}"`,
        actionUrl: '/campaigns',
      };
    case 'campaign_deleted':
      return {
        type: 'team_activity',
        title: 'Campaign deleted',
        message: `${actorName} deleted "${activity.resourceName}"`,
      };
    case 'video_generated':
      return {
        type: 'video_generation_complete',
        title: 'Video generated',
        message: `${actorName} generated a new video: "${activity.resourceName}"`,
        actionUrl: '/videos',
      };
    case 'video_uploaded':
      return {
        type: 'team_activity',
        title: 'Video uploaded',
        message: `${actorName} uploaded "${activity.resourceName}"`,
        actionUrl: '/videos',
      };
    case 'video_deleted':
      return {
        type: 'team_activity',
        title: 'Video deleted',
        message: `${actorName} deleted "${activity.resourceName}"`,
      };
    case 'asset_created':
      return {
        type: 'team_activity',
        title: 'Asset created',
        message: `${actorName} created "${activity.resourceName}"`,
        actionUrl: '/assets',
      };
    case 'asset_updated':
      return {
        type: 'team_activity',
        title: 'Asset updated',
        message: `${actorName} updated "${activity.resourceName}"`,
        actionUrl: '/assets',
      };
    case 'asset_deleted':
      return {
        type: 'team_activity',
        title: 'Asset deleted',
        message: `${actorName} deleted "${activity.resourceName}"`,
      };
    case 'access_updated':
      return {
        type: 'team_activity',
        title: 'Access updated',
        message: `${actorName} updated access settings`,
        actionUrl: '/access',
      };
    default:
      return null;
  }
}

/**
 * Log an activity to the activities collection
 * Used to track user actions across the platform
 * Also creates notifications for the user who performed the action
 */
export async function logActivity(
  activity: Omit<Activity, 'id' | 'createdAt'>
): Promise<void> {
  try {
    // Log the activity
    await addDoc(collection(db, ACTIVITIES_COLLECTION), {
      ...activity,
      createdAt: Timestamp.now(),
    });

    // Create a notification for the user
    const notificationDetails = getNotificationDetailsFromActivity(activity);
    if (notificationDetails) {
      await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
        userId: activity.userId,
        type: notificationDetails.type,
        title: notificationDetails.title,
        message: notificationDetails.message,
        priority: 'normal',
        read: false,
        actorId: activity.userId,
        actorName: activity.userName || activity.userEmail.split('@')[0],
        actorEmail: activity.userEmail,
        resourceId: activity.resourceId,
        resourceType: activity.resourceType,
        resourceName: activity.resourceName,
        actionUrl: notificationDetails.actionUrl,
        createdAt: Timestamp.now(),
      });
    }
  } catch (error) {
    // Don't throw - activity logging should not break the main operation
    console.error('Failed to log activity:', error);
  }
}

/**
 * Get recent activities for display on the home page
 * Returns activities sorted by creation time, most recent first
 */
export async function getRecentActivities(limitCount: number = 5): Promise<Activity[]> {
  const q = query(
    collection(db, ACTIVITIES_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
    } as Activity;
  });
}

// Notification Operations

/**
 * Create a new notification
 */
export async function createNotification(
  notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>
): Promise<string> {
  const docRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    ...notification,
    read: false,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

/**
 * Get notifications for a specific user
 */
export async function getUserNotifications(
  userId: string,
  limitCount: number = 20
): Promise<AppNotification[]> {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      expiresAt: data.expiresAt ? timestampToDate(data.expiresAt) : undefined,
    } as AppNotification;
  });
}

/**
 * Subscribe to real-time notification updates for a user
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void
): Unsubscribe {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: timestampToDate(data.createdAt),
        expiresAt: data.expiresAt ? timestampToDate(data.expiresAt) : undefined,
      } as AppNotification;
    });
    callback(notifications);
  });
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
  await updateDoc(docRef, { read: true });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', userId),
    where('read', '==', false)
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  
  snapshot.docs.forEach(docSnap => {
    batch.update(docSnap.ref, { read: true });
  });

  await batch.commit();
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
  await deleteDoc(docRef);
}

/**
 * Delete old notifications (cleanup)
 */
export async function cleanupOldNotifications(userId: string, daysOld: number = 30): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', userId),
    where('createdAt', '<', Timestamp.fromDate(cutoffDate))
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  
  snapshot.docs.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });

  await batch.commit();
}

// Competencies CRUD Operations

/**
 * Get all competencies from Firestore
 */
export async function getCompetencies(): Promise<CompetencyDefinition[]> {
  const q = query(
    collection(db, COMPETENCIES_COLLECTION),
    orderBy('order', 'asc')
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name,
        description: data.description,
        skills: data.skills || [],
      } as CompetencyDefinition;
    });
  } catch (error) {
    console.error('Failed to fetch competencies:', error);
    return [];
  }
}

/**
 * Get a single competency by ID
 */
export async function getCompetency(competencyId: string): Promise<CompetencyDefinition | null> {
  const docRef = doc(db, COMPETENCIES_COLLECTION, competencyId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    description: data.description,
    skills: data.skills || [],
  };
}

/**
 * Create a new competency
 */
export async function createCompetency(
  data: {
    name: string;
    description: string;
    skills?: SkillDefinition[];
  }
): Promise<string> {
  // Get current count for ordering
  const existing = await getCompetencies();
  const order = existing.length;

  const docRef = await addDoc(collection(db, COMPETENCIES_COLLECTION), {
    name: data.name,
    description: data.description,
    skills: data.skills || [],
    order,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  console.log('✅ Competency created:', docRef.id);
  return docRef.id;
}

/**
 * Update an existing competency
 */
export async function updateCompetency(
  competencyId: string,
  data: Partial<{
    name: string;
    description: string;
    skills: SkillDefinition[];
  }>
): Promise<void> {
  const docRef = doc(db, COMPETENCIES_COLLECTION, competencyId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });

  console.log('✅ Competency updated:', competencyId);
}

/**
 * Delete a competency
 */
export async function deleteCompetency(competencyId: string): Promise<void> {
  const docRef = doc(db, COMPETENCIES_COLLECTION, competencyId);
  await deleteDoc(docRef);

  console.log('✅ Competency deleted:', competencyId);
}

/**
 * Reorder competencies
 */
export async function reorderCompetencies(orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db);

  orderedIds.forEach((id, index) => {
    const docRef = doc(db, COMPETENCIES_COLLECTION, id);
    batch.update(docRef, {
      order: index,
      updatedAt: Timestamp.now(),
    });
  });

  await batch.commit();
  console.log('✅ Competencies reordered');
}

/**
 * Subscribe to real-time competencies updates
 */
export function subscribeToCompetencies(
  callback: (competencies: CompetencyDefinition[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COMPETENCIES_COLLECTION),
    orderBy('order', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const competencies = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name,
        description: data.description,
        skills: data.skills || [],
      } as CompetencyDefinition;
    });
    callback(competencies);
  });
}

/**
 * Initialize competencies collection with default data
 * Only runs if the collection is empty
 */
export async function initializeCompetencies(
  defaultCompetencies: CompetencyDefinition[]
): Promise<boolean> {
  const existing = await getCompetencies();
  
  if (existing.length > 0) {
    console.log('ℹ️ Competencies already initialized');
    return false;
  }

  const batch = writeBatch(db);

  defaultCompetencies.forEach((competency, index) => {
    const docRef = doc(db, COMPETENCIES_COLLECTION, competency.id);
    batch.set(docRef, {
      name: competency.name,
      description: competency.description,
      skills: competency.skills,
      order: index,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });

  await batch.commit();
  console.log('✅ Competencies initialized with', defaultCompetencies.length, 'items');
  return true;
}
