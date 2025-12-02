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
  Timestamp,
  QueryConstraint,
  writeBatch,
  documentId,
  setDoc,
  runTransaction,
  deleteField,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from './firebase';
import type {
  Campaign,
  CampaignDoc,
  CampaignItem,
  Video,
  Asset,
  AssetType,
  Organization,
  Invitation,
  InvitationStatus,
  Employee,
  CampaignEnrollment,
  CampaignProgress,
  CampaignResponse,
  CampaignNotification,
  CampaignInstance,
  NotificationType,
  ModuleProgress,
} from '@/types';

const CAMPAIGNS_COLLECTION = 'campaigns';
const CAMPAIGN_ITEMS_COLLECTION = 'campaignItems';
const VIDEOS_COLLECTION = 'videos';
const ASSETS_COLLECTION = 'assets';
const USERS_COLLECTION = 'users';
const COHORTS_COLLECTION = 'cohorts';
const ORGANIZATIONS_COLLECTION = 'organizations';
const INVITATIONS_COLLECTION = 'invitations';
export const CAMPAIGN_ENROLLMENTS_COLLECTION = 'campaignEnrollments';
const CAMPAIGN_PROGRESS_COLLECTION = 'campaignProgress';
export const CAMPAIGN_RESPONSES_COLLECTION = 'campaignResponses';
const CAMPAIGN_NOTIFICATIONS_COLLECTION = 'campaignNotifications';
const CAMPAIGN_INSTANCES_COLLECTION = 'campaignInstances';

function logFirestoreOperation(operation: string, collectionName: string, details?: Record<string, unknown>) {
  console.log(`🔥 Firestore ${operation}:`, {
    collection: collectionName,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Remove undefined values from an object (Firestore doesn't allow undefined)
 */
function removeUndefined(obj: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      const isTimestamp = value instanceof Timestamp;
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !isTimestamp) {
        cleaned[key] = removeUndefined(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

function timestampToDate(timestamp: any): Date {
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  return new Date(timestamp);
}

const DEFAULT_MODULE_QUESTION_TARGET = 3;

export function parseModuleProgressData(raw?: Record<string, any>): Record<string, ModuleProgress> {
  if (!raw) {
    return {};
  }

  const parsed: Record<string, ModuleProgress> = {};
  for (const [moduleId, value] of Object.entries(raw)) {
    parsed[moduleId] = {
      videoFinished: !!value.videoFinished,
      questionsAnswered: value.questionsAnswered ?? 0,
      questionTarget: value.questionTarget ?? DEFAULT_MODULE_QUESTION_TARGET,
      completed: !!value.completed,
      completedAt: value.completedAt ? timestampToDate(value.completedAt) : undefined,
      answeredQuestionIds: Array.isArray((value as any).answeredQuestionIds)
        ? (value as any).answeredQuestionIds
        : undefined,
    };
  }
  return parsed;
}

function serializeModuleProgressData(progress: Record<string, ModuleProgress>): Record<string, any> {
  const serialized: Record<string, any> = {};
  for (const [moduleId, value] of Object.entries(progress)) {
    serialized[moduleId] = {
      videoFinished: value.videoFinished,
      questionsAnswered: value.questionsAnswered,
      questionTarget: value.questionTarget,
      completed: value.completed,
      completedAt: value.completedAt
        ? value.completedAt instanceof Timestamp
          ? value.completedAt
          : Timestamp.fromDate(new Date(value.completedAt))
        : null,
      answeredQuestionIds: value.answeredQuestionIds && value.answeredQuestionIds.length > 0
        ? value.answeredQuestionIds
        : undefined,
    };

    if (!serialized[moduleId].completedAt) {
      delete serialized[moduleId].completedAt;
    }
    if (!serialized[moduleId].answeredQuestionIds) {
      delete serialized[moduleId].answeredQuestionIds;
    }
  }
  return serialized;
}

function countCompletedModules(progress: Record<string, ModuleProgress>): number {
  return Object.values(progress).filter((module) => module.completed).length;
}

async function fetchCampaignModuleCount(campaignId: string): Promise<number> {
  try {
    const campaign = await getCampaign(campaignId);
    return campaign?.items?.length ?? 0;
  } catch (error) {
    console.error('[firestore] Failed to fetch campaign for module count', error);
    return 0;
  }
}

export function buildEnrollmentFromData(id: string, data: any): CampaignEnrollment {
  return {
    id,
    campaignId: data.campaignId,
    userId: data.userId,
    organizationId: data.organizationId,
    status: data.status,
    enrolledAt: timestampToDate(data.enrolledAt),
    startedAt: data.startedAt ? timestampToDate(data.startedAt) : undefined,
    completedAt: data.completedAt ? timestampToDate(data.completedAt) : undefined,
    accessCount: data.accessCount || 0,
    lastAccessedAt: data.lastAccessedAt ? timestampToDate(data.lastAccessedAt) : undefined,
    totalModules: data.totalModules || data.totalModuleCount || 0,
    completedModules: data.completedModules || 0,
    moduleProgress: parseModuleProgressData(data.moduleProgress),
    metadata: data.metadata || { autoEnrolled: false },
  };
}

async function resolveEnrollmentTotalModules(enrollment: CampaignEnrollment): Promise<number> {
  if (enrollment.totalModules && enrollment.totalModules > 0) {
    return enrollment.totalModules;
  }
  return fetchCampaignModuleCount(enrollment.campaignId);
}

export async function createCampaign(
  userId: string,
  data: {
    title: string;
    description: string;
    skillFocus: string;
    tags?: string[];
    userOrganization?: string;
  }
): Promise<string> {
  const campaignDoc: Omit<CampaignDoc, 'id'> = {
    title: data.title,
    description: data.description,
    skillFocus: data.skillFocus,
    itemIds: [],
    source: 'organization', // Campaigns created in Client Console are organization campaigns
    // Track owning organization and keep allowlist seeded with it
    ...(data.userOrganization ? { organization: data.userOrganization } : {}),
    // Auto-assign to user's organization if they have one
    allowedOrganizations: data.userOrganization ? [data.userOrganization] : undefined,
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
  // Debug: Check authentication status
  const currentUser = auth.currentUser;
  console.log('[getCampaign] Auth status:', {
    isAuthenticated: !!currentUser,
    userId: currentUser?.uid,
    email: currentUser?.email,
    campaignId
  });

  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    console.log('[getCampaign] Campaign not found:', campaignId);
    return null;
  }

  const data = docSnap.data() as CampaignDoc;
  console.log('[getCampaign] Campaign data:', {
    campaignId,
    createdBy: data.metadata?.createdBy,
    hasItems: data.itemIds?.length > 0,
    itemCount: data.itemIds?.length
  });

  const items = await batchGetCampaignItems(data.itemIds);

  return {
    id: docSnap.id,
    title: data.title,
    description: data.description,
    skillFocus: data.skillFocus,
    items: items.sort((a, b) => a.order - b.order),
    source: data.source,
    pinned: data.pinned,
    campaignType: data.campaignType,
    anonymousResponses: data.anonymousResponses,
    allowedOrganizations: data.allowedOrganizations,
    allowedDepartments: data.allowedDepartments,
    allowedEmployeeIds: data.allowedEmployeeIds,
    allowedCohortIds: data.allowedCohortIds,
    schedule: data.schedule,
    accessControl: data.accessControl,
    automation: data.automation,
    stats: data.stats,
    recurringConfig: data.recurringConfig,
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

export async function getCampaignsByOrganization(
  userOrganization?: string | null,
  userDepartment?: string,
  userId?: string,
  userCohortIds?: string[]
): Promise<Campaign[]> {
  // Fetch all campaigns
  const q = query(
    collection(db, CAMPAIGNS_COLLECTION),
    orderBy('metadata.updatedAt', 'desc')
  );

  const querySnapshot = await getDocs(q);
  const campaigns: Campaign[] = [];

  for (const docSnap of querySnapshot.docs) {
    const campaign = await getCampaign(docSnap.id);
    if (!campaign) continue;

    // If user has no organization, they can access ALL campaigns
    if (!userOrganization) {
      campaigns.push(campaign);
      continue;
    }

    // Check organization-level access
    const allowedOrgs = campaign.allowedOrganizations;

    // If campaign has no organization restrictions, it's accessible to all
    if (!allowedOrgs || allowedOrgs.length === 0) {
      campaigns.push(campaign);
      continue;
    }

    // Campaign has organization restrictions - check if user's org matches
    if (!allowedOrgs.includes(userOrganization)) {
      continue; // User's organization not in allowed list
    }

    // Organization matches - now check granular filters
    const { allowedDepartments, allowedEmployeeIds, allowedCohortIds } = campaign;

    // If no granular filters, user has access
    const hasGranularFilters =
      (allowedDepartments && allowedDepartments.length > 0) ||
      (allowedEmployeeIds && allowedEmployeeIds.length > 0) ||
      (allowedCohortIds && allowedCohortIds.length > 0);

    if (!hasGranularFilters) {
      campaigns.push(campaign);
      continue;
    }

    // Check department filter
    if (allowedDepartments && allowedDepartments.length > 0) {
      if (userDepartment && allowedDepartments.includes(userDepartment)) {
        campaigns.push(campaign);
        continue;
      }
    }

    // Check employee ID filter
    if (allowedEmployeeIds && allowedEmployeeIds.length > 0) {
      if (userId && allowedEmployeeIds.includes(userId)) {
        campaigns.push(campaign);
        continue;
      }
    }

    // Check cohort filter
    if (allowedCohortIds && allowedCohortIds.length > 0 && userCohortIds) {
      const hasMatchingCohort = userCohortIds.some(cohortId =>
        allowedCohortIds.includes(cohortId)
      );
      if (hasMatchingCohort) {
        campaigns.push(campaign);
        continue;
      }
    }
  }

  return campaigns;
}

export async function getCampaignsForAdmin(
  userOrganization?: string | null
): Promise<Campaign[]> {
  const campaigns: Campaign[] = [];
  const seen = new Set<string>();
  const base = collection(db, CAMPAIGNS_COLLECTION);
  const queries = [];

  // DiCode global (allowlist empty)
  queries.push(
    getDocs(
      query(
        base,
        where('source', '==', 'dicode'),
        where('allowedOrganizations', '==', []),
        orderBy('metadata.updatedAt', 'desc')
      )
    )
  );
  // DiCode global with null/missing allowlist
  queries.push(
    getDocs(
      query(
        base,
        where('source', '==', 'dicode'),
        where('allowedOrganizations', '==', null),
        orderBy('metadata.updatedAt', 'desc')
      )
    )
  );

  // DiCode restricted to org
  if (userOrganization) {
    queries.push(
      getDocs(
        query(
          base,
          where('source', '==', 'dicode'),
          where('allowedOrganizations', 'array-contains', userOrganization),
          orderBy('metadata.updatedAt', 'desc')
        )
      )
    );
  }

  // Org campaigns for this org
  if (userOrganization) {
    queries.push(
      getDocs(
        query(
          base,
          where('source', '==', 'organization'),
          where('allowedOrganizations', 'array-contains', userOrganization),
          orderBy('metadata.updatedAt', 'desc')
        )
      )
    );
  }

  const snapshots = await Promise.all(queries);

  for (const snap of snapshots) {
    for (const docSnap of snap.docs) {
      if (seen.has(docSnap.id)) continue;
      const campaign = await getCampaign(docSnap.id);
      if (campaign) {
        // For DiCode global queries, ensure allowlist truly empty/null/missing
        if (
          campaign.source === 'dicode' &&
          campaign.allowedOrganizations &&
          campaign.allowedOrganizations.length > 0 &&
          userOrganization &&
          !campaign.allowedOrganizations.includes(userOrganization)
        ) {
          continue;
        }
        campaigns.push(campaign);
        seen.add(docSnap.id);
      }
    }
  }

  return campaigns;
}

export async function getPublishedCampaigns(
  userOrganization?: string | null,
  userDepartment?: string,
  userId?: string,
  userCohortIds?: string[]
): Promise<Campaign[]> {
  const campaigns: Campaign[] = [];
  const seen = new Set<string>();
  const base = collection(db, CAMPAIGNS_COLLECTION);
  const queries = [];

  // DiCode global (allowlist empty)
  queries.push(
    getDocs(
      query(
        base,
        where('metadata.isPublished', '==', true),
        where('source', '==', 'dicode'),
        where('allowedOrganizations', '==', []),
        orderBy('metadata.updatedAt', 'desc')
      )
    )
  );
  // DiCode global with null/missing allowlist
  queries.push(
    getDocs(
      query(
        base,
        where('metadata.isPublished', '==', true),
        where('source', '==', 'dicode'),
        where('allowedOrganizations', '==', null),
        orderBy('metadata.updatedAt', 'desc')
      )
    )
  );

  // DiCode restricted to org
  if (userOrganization) {
    queries.push(
      getDocs(
        query(
          base,
          where('metadata.isPublished', '==', true),
          where('source', '==', 'dicode'),
          where('allowedOrganizations', 'array-contains', userOrganization),
          orderBy('metadata.updatedAt', 'desc')
        )
      )
    );
  }

  // Org campaigns for this org
  if (userOrganization) {
    queries.push(
      getDocs(
        query(
          base,
          where('metadata.isPublished', '==', true),
          where('source', '==', 'organization'),
          where('allowedOrganizations', 'array-contains', userOrganization),
          orderBy('metadata.updatedAt', 'desc')
        )
      )
    );
  }

  // If user has no org, fall back to broad published list
  if (!userOrganization) {
    queries.push(
      getDocs(query(base, where('metadata.isPublished', '==', true), orderBy('metadata.updatedAt', 'desc')))
    );
  }

  const snapshots = await Promise.all(queries);

  for (const snap of snapshots) {
    for (const docSnap of snap.docs) {
      if (seen.has(docSnap.id)) continue;
      const campaign = await getCampaign(docSnap.id);
      if (!campaign) continue;
      seen.add(docSnap.id);

      // For DiCode global queries, ensure allowlist truly empty/null/missing
      if (
        campaign.source === 'dicode' &&
        campaign.allowedOrganizations &&
        campaign.allowedOrganizations.length > 0 &&
        userOrganization &&
        !campaign.allowedOrganizations.includes(userOrganization)
      ) {
        continue;
      }

      // Organization-level gate already handled by query; now enforce granular filters
      const { allowedDepartments, allowedEmployeeIds, allowedCohortIds } = campaign;

      // If user has no organization, no further filters apply
      if (!userOrganization) {
        campaigns.push(campaign);
        continue;
      }

      const hasGranularFilters =
        (allowedDepartments && allowedDepartments.length > 0) ||
        (allowedEmployeeIds && allowedEmployeeIds.length > 0) ||
        (allowedCohortIds && allowedCohortIds.length > 0);

      if (!hasGranularFilters) {
        campaigns.push(campaign);
        continue;
      }

      // Department filter
      if (allowedDepartments && allowedDepartments.length > 0) {
        if (userDepartment && allowedDepartments.includes(userDepartment)) {
          campaigns.push(campaign);
          continue;
        }
      }

      // Employee filter
      if (allowedEmployeeIds && allowedEmployeeIds.length > 0) {
        if (userId && allowedEmployeeIds.includes(userId)) {
          campaigns.push(campaign);
          continue;
        }
      }

      // Cohort filter
      if (allowedCohortIds && allowedCohortIds.length > 0 && userCohortIds) {
        const hasMatchingCohort = userCohortIds.some(cohortId =>
          allowedCohortIds.includes(cohortId)
        );
        if (hasMatchingCohort) {
          campaigns.push(campaign);
          continue;
        }
      }
    }
  }

  return campaigns;
}

export async function updateCampaign(
  campaignId: string,
  data: Partial<Omit<CampaignDoc, 'id' | 'metadata'>>
): Promise<void> {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  const cleanData = removeUndefined({
    ...data,
    'metadata.updatedAt': Timestamp.now(),
  });
  await updateDoc(docRef, cleanData);
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return;

  const itemIds = campaign.items.map((item) => item.id);
  if (itemIds.length > 0) {
    await batchDeleteCampaignItems(campaignId, itemIds);
  }

  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  await deleteDoc(docRef);
}

export async function setCampaignPublishState(campaignId: string, isPublished: boolean): Promise<void> {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  await updateDoc(docRef, {
    'metadata.isPublished': isPublished,
    'metadata.updatedAt': Timestamp.now(),
  });
}

export async function batchGetCampaignItems(itemIds: string[]): Promise<CampaignItem[]> {
  if (itemIds.length === 0) return [];

  const BATCH_SIZE = 10;
  const batches: string[][] = [];

  for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
    batches.push(itemIds.slice(i, i + BATCH_SIZE));
  }

  const allItems: CampaignItem[] = [];

  for (const batch of batches) {
    const q = query(collection(db, CAMPAIGN_ITEMS_COLLECTION), where(documentId(), 'in', batch));

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

  const itemMap = new Map(allItems.map((item) => [item.id, item]));
  return itemIds.map((id) => itemMap.get(id)).filter((item): item is CampaignItem => item !== undefined);
}

export async function createCampaignItem(
  campaignId: string,
  videoId: string,
  order: number,
  questions: CampaignItem['questions']
): Promise<string> {
  const itemDoc: Omit<CampaignItem, 'id'> = {
    campaignId,
    videoId,
    order,
    questions,
    metadata: {
      createdAt: Timestamp.now() as any,
      updatedAt: Timestamp.now() as any,
    },
  };

  const docRef = await addDoc(collection(db, CAMPAIGN_ITEMS_COLLECTION), itemDoc);

  const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  const campaignSnap = await getDoc(campaignRef);
  if (campaignSnap.exists()) {
    const campaignData = campaignSnap.data() as CampaignDoc;
    await updateDoc(campaignRef, {
      itemIds: [...campaignData.itemIds, docRef.id],
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

  const campaignRef = doc(db, CAMPAIGNS_COLLECTION, item.campaignId);
  const campaignSnap = await getDoc(campaignRef);
  if (campaignSnap.exists()) {
    const campaignData = campaignSnap.data() as CampaignDoc;
    await updateDoc(campaignRef, {
      itemIds: campaignData.itemIds.filter((id) => id !== itemId),
      'metadata.updatedAt': Timestamp.now(),
    });
  }

  const docRef = doc(db, CAMPAIGN_ITEMS_COLLECTION, itemId);
  await deleteDoc(docRef);
}

export async function batchDeleteCampaignItems(campaignId: string, itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;

  const batch = writeBatch(db);
  const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  const campaignSnap = await getDoc(campaignRef);

  if (campaignSnap.exists()) {
    const campaignData = campaignSnap.data() as CampaignDoc;
    const updatedItemIds = campaignData.itemIds.filter((id) => !itemIds.includes(id));

    batch.update(campaignRef, {
      itemIds: updatedItemIds,
      'metadata.updatedAt': Timestamp.now(),
    });
  }

  itemIds.forEach((itemId) => {
    const itemRef = doc(db, CAMPAIGN_ITEMS_COLLECTION, itemId);
    batch.delete(itemRef);
  });

  await batch.commit();
}

export async function createVideo(
  userId: string,
  data: {
    title: string;
    description?: string;
    storageUrl: string;
    thumbnailUrl?: string;
    source: Video['source'];
    duration?: number;
    generationData?: Video['generationData'];
    tags?: string[];
  }
): Promise<string> {
  logFirestoreOperation('CREATE', VIDEOS_COLLECTION, {
    userId,
    title: data.title,
    source: data.source,
    tags: data.tags,
  });

  const videoDoc: Omit<Video, 'id'> = {
    title: data.title,
    description: data.description,
    storageUrl: data.storageUrl,
    thumbnailUrl: data.thumbnailUrl,
    source: data.source,
    duration: data.duration,
    generationData: data.generationData,
    metadata: {
      createdAt: Timestamp.now() as any,
      updatedAt: Timestamp.now() as any,
      createdBy: userId,
      tags: data.tags || [],
    },
  };

  try {
    const docRef = await addDoc(collection(db, VIDEOS_COLLECTION), videoDoc);
    console.log('✅ Video created successfully:', docRef.id);
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
  logFirestoreOperation('READ', VIDEOS_COLLECTION, {});

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
    console.error('❌ Failed to fetch videos:', error);
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

// TODO: Implement video usage tracking (needs workspace types first)
// Track when videos are:
// 1. Added to campaigns (increment on campaign item creation)
// 2. Viewed/played by employees (increment on video play)
// 3. Downloaded (increment on download)
// Implementation should follow Assets pattern with atomic increment():
// - incrementVideoUsage(videoId: string, amount = 1): Promise<void>
// - Use Firebase increment() function for atomic updates
// - Update metadata.usageCount and metadata.lastUsedAt

export async function deleteVideo(videoId: string): Promise<void> {
  const docRef = doc(db, VIDEOS_COLLECTION, videoId);
  await deleteDoc(docRef);
}

export async function createAsset(
  userId: string,
  data: {
    type: AssetType;
    name: string;
    description: string;
    tags?: string[];
  }
): Promise<string> {
  const assetDoc: Omit<Asset, 'id'> = {
    type: data.type,
    name: data.name,
    description: data.description,
    metadata: {
      createdAt: Timestamp.now() as any,
      updatedAt: Timestamp.now() as any,
      createdBy: userId,
      tags: data.tags || [],
      usageCount: 0,
    },
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

  const data = docSnap.data() as Omit<Asset, 'id'>;
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

export async function getAssetsByUser(userId: string, type?: AssetType): Promise<Asset[]> {
  const constraints: QueryConstraint[] = [
    where('metadata.createdBy', '==', userId),
    orderBy('metadata.createdAt', 'desc'),
  ];

  if (type) {
    constraints.unshift(where('type', '==', type));
  }

  const q = query(collection(db, ASSETS_COLLECTION), ...constraints);

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Omit<Asset, 'id'>;
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

export async function incrementAssetUsage(assetId: string): Promise<void> {
  const asset = await getAsset(assetId);
  if (!asset) return;

  const docRef = doc(db, ASSETS_COLLECTION, assetId);
  await updateDoc(docRef, {
    'metadata.usageCount': (asset.metadata.usageCount || 0) + 1,
    'metadata.updatedAt': Timestamp.now(),
  });
}

export type UserProfileDoc = {
  role: 'admin' | 'employee';
  department?: string | null;
  organization?: string | null;
  name?: string | null;
  avatar?: string | null;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say' | null;
  dateOfBirth?: Date | Timestamp | null;
  requirePasswordChange?: boolean;
  onboardingCompletedAt?: Date | Timestamp | null;
  invitationId?: string | null;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
};

export async function getUserProfile(uid: string): Promise<UserProfileDoc | null> {
  const profileRef = doc(db, USERS_COLLECTION, uid);
  const snap = await getDoc(profileRef);
  if (!snap.exists()) {
    return null;
  }
  const data = snap.data() as UserProfileDoc;
  return {
    ...data,
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  };
}

type UserProfileUpdate = Partial<Omit<UserProfileDoc, 'createdAt' | 'updatedAt'>> & {
  createdAt?: Date | Timestamp;
};

export async function upsertUserProfile(uid: string, profile: UserProfileUpdate): Promise<UserProfileDoc> {
  const profileRef = doc(db, USERS_COLLECTION, uid);
  const now = Timestamp.now();

  // Build update object with all provided fields
  const updateData: any = {
    updatedAt: now,
  };

  // Only set fields that are explicitly provided
  if (profile.role !== undefined) updateData.role = profile.role;
  if (profile.department !== undefined) updateData.department = profile.department;
  if (profile.organization !== undefined) updateData.organization = profile.organization;
  if (profile.name !== undefined) updateData.name = profile.name;
  if (profile.avatar !== undefined) updateData.avatar = profile.avatar;
  if (profile.gender !== undefined) updateData.gender = profile.gender;
  if (profile.dateOfBirth !== undefined) updateData.dateOfBirth = profile.dateOfBirth;
  if (profile.requirePasswordChange !== undefined) updateData.requirePasswordChange = profile.requirePasswordChange;
  if (profile.onboardingCompletedAt !== undefined) updateData.onboardingCompletedAt = profile.onboardingCompletedAt;
  if (profile.invitationId !== undefined) updateData.invitationId = profile.invitationId;
  if (profile.createdAt !== undefined) updateData.createdAt = profile.createdAt;

  // If createdAt not provided and this is a new document, set it
  const existing = await getDoc(profileRef);
  if (!existing.exists() && !profile.createdAt) {
    updateData.createdAt = now;
  }

  await setDoc(profileRef, updateData, { merge: true });

  const updated = await getDoc(profileRef);
  const data = updated.data() as UserProfileDoc;
  return {
    ...data,
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  };
}

/**
 * Get all users (employees) in an organization
 */
export async function getUsersByOrganization(organizationId: string): Promise<Employee[]> {
  logFirestoreOperation('QUERY', USERS_COLLECTION, { organization: organizationId });

  const usersQuery = query(
    collection(db, USERS_COLLECTION),
    where('organization', '==', organizationId)
  );

  const snapshot = await getDocs(usersQuery);
  const users = await Promise.all(
    snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();

      // Get user's cohorts
      const cohortIds = await getUserCohorts(docSnap.id, organizationId);

      return {
        id: docSnap.id,
        email: data.email || '',
        name: data.name || data.email || 'Unknown',
        role: data.role || 'employee',
        department: data.department || undefined,
        organization: data.organization || undefined,
        avatar: data.avatar || undefined,
        cohortIds: cohortIds.length > 0 ? cohortIds : undefined,
        gender: data.gender || undefined,
        dateOfBirth: data.dateOfBirth ? timestampToDate(data.dateOfBirth) : undefined,
        createdAt: timestampToDate(data.createdAt || new Date()),
        lastLogin: data.lastLogin ? timestampToDate(data.lastLogin) : undefined,
        status: (data.status || 'active') as 'active' | 'inactive',
      };
    })
  );

  console.log(`✅ Loaded ${users.length} users for organization ${organizationId}`);
  return users;
}

/**
 * Delete a user profile from Firestore
 * Note: This only deletes the Firestore user document, not the Firebase Auth account
 * TODO: Implement Cloud Function to also delete Firebase Auth account
 */
export async function deleteUserProfile(userId: string): Promise<void> {
  logFirestoreOperation('DELETE', USERS_COLLECTION, { id: userId });

  const userRef = doc(db, USERS_COLLECTION, userId);
  await deleteDoc(userRef);

  console.log(`✅ User profile deleted: ${userId}`);
}

// ============================================
// ORGANIZATION MANAGEMENT
// ============================================

export async function createOrganization(
  data: {
    name: string;
    slug: string;
    industry?: string;
    region?: string;
    size?: 'small' | 'medium' | 'large' | 'enterprise';
    departments?: string[];
    adminIds: string[];
    createdBy: string;
  }
): Promise<string> {
  logFirestoreOperation('CREATE', ORGANIZATIONS_COLLECTION, { name: data.name, slug: data.slug });

  const organizationDoc: Omit<Organization, 'id'> = {
    name: data.name,
    slug: data.slug,
    industry: data.industry,
    region: data.region,
    size: data.size,
    departments: data.departments || [],
    settings: {
      logo: undefined,
      primaryColor: undefined,
      secondaryColor: undefined,
      backgroundColor: undefined,
    },
    adminIds: data.adminIds,
    subscription: {
      plan: 'free',
      status: 'trial',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
    },
    metadata: {
      createdAt: Timestamp.now() as any,
      updatedAt: Timestamp.now() as any,
      createdBy: data.createdBy,
    },
  };

  const cleanOrganizationDoc = removeUndefined(organizationDoc) as Omit<Organization, 'id'>;

  const docRef = await addDoc(collection(db, ORGANIZATIONS_COLLECTION), cleanOrganizationDoc);
  console.log(`✅ Organization created:`, docRef.id);
  return docRef.id;
}

export async function getOrganization(organizationId: string): Promise<Organization | null> {
  logFirestoreOperation('READ', ORGANIZATIONS_COLLECTION, { id: organizationId });

  const docRef = doc(db, ORGANIZATIONS_COLLECTION, organizationId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    console.log(`❌ Organization not found:`, organizationId);
    return null;
  }

  const data = docSnap.data() as Omit<Organization, 'id'>;
  return {
    id: docSnap.id,
    ...data,
    metadata: {
      ...data.metadata,
      createdAt: timestampToDate(data.metadata.createdAt),
      updatedAt: timestampToDate(data.metadata.updatedAt),
    },
    subscription: data.subscription ? {
      ...data.subscription,
      expiresAt: data.subscription.expiresAt ? timestampToDate(data.subscription.expiresAt) : undefined,
    } : undefined,
  };
}

export async function updateOrganization(
  organizationId: string,
  data: Partial<Omit<Organization, 'id' | 'metadata' | 'slug'>>
): Promise<void> {
  logFirestoreOperation('UPDATE', ORGANIZATIONS_COLLECTION, { id: organizationId });

  const docRef = doc(db, ORGANIZATIONS_COLLECTION, organizationId);

  // Remove undefined values (Firestore doesn't allow them)
  const cleanData = removeUndefined({
    ...data,
    'metadata.updatedAt': Timestamp.now(),
  });

  await updateDoc(docRef, cleanData);
  console.log(`✅ Organization updated:`, organizationId);
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  logFirestoreOperation('READ', ORGANIZATIONS_COLLECTION, { slug });

  const q = query(
    collection(db, ORGANIZATIONS_COLLECTION),
    where('slug', '==', slug)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    console.log(`❌ Organization not found with slug:`, slug);
    return null;
  }

  const docSnap = querySnapshot.docs[0];
  const data = docSnap.data() as Omit<Organization, 'id'>;

  return {
    id: docSnap.id,
    ...data,
    metadata: {
      ...data.metadata,
      createdAt: timestampToDate(data.metadata.createdAt),
      updatedAt: timestampToDate(data.metadata.updatedAt),
    },
    subscription: data.subscription ? {
      ...data.subscription,
      expiresAt: data.subscription.expiresAt ? timestampToDate(data.subscription.expiresAt) : undefined,
    } : undefined,
  };
}

export async function addAdminToOrganization(organizationId: string, userId: string): Promise<void> {
  const org = await getOrganization(organizationId);
  if (!org) throw new Error('Organization not found');

  if (!org.adminIds.includes(userId)) {
    await updateOrganization(organizationId, {
      adminIds: [...org.adminIds, userId],
    });
  }
}

export async function removeAdminFromOrganization(organizationId: string, userId: string): Promise<void> {
  const org = await getOrganization(organizationId);
  if (!org) throw new Error('Organization not found');

  await updateOrganization(organizationId, {
    adminIds: org.adminIds.filter(id => id !== userId),
  });
}

// ============================================
// COHORT MANAGEMENT
// ============================================

export async function createCohort(
  name: string,
  description?: string,
  employeeIds: string[] = [],
  organization?: string
): Promise<string> {
  logFirestoreOperation('CREATE', COHORTS_COLLECTION, { name, organization });

  const cohortDoc = {
    name,
    description: description || null,
    employeeIds,
    organization: organization || null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  try {
    const docRef = await addDoc(collection(db, COHORTS_COLLECTION), cohortDoc);
    console.log('✅ Cohort created successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Failed to create cohort:', error);
    throw error;
  }
}

export async function getCohort(cohortId: string): Promise<{
  id: string;
  name: string;
  description: string | null;
  employeeIds: string[];
  organization: string | null;
  createdAt: Date;
  updatedAt: Date;
} | null> {
  const docRef = doc(db, COHORTS_COLLECTION, cohortId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    description: data.description,
    employeeIds: data.employeeIds || [],
    organization: data.organization,
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  };
}

export async function getCohortsByOrganization(
  organization?: string | null
): Promise<
  Array<{
    id: string;
    name: string;
    description: string | null;
    employeeIds: string[];
    organization: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>
> {
  logFirestoreOperation('READ', COHORTS_COLLECTION, { organization });

  // If no organization is provided, do not issue a broad query under restrictive rules
  if (!organization) {
    console.warn('[getCohortsByOrganization] No organization provided; returning empty list.');
    return [];
  }

  // Get cohorts for specific organization
  const q = query(
    collection(db, COHORTS_COLLECTION),
    where('organization', '==', organization),
    orderBy('createdAt', 'desc')
  );

  try {
    const querySnapshot = await getDocs(q);
    console.log(`✅ Found ${querySnapshot.docs.length} cohorts`);

    return querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name,
        description: data.description || null,
        employeeIds: data.employeeIds || [],
        organization: data.organization || null,
        createdAt: timestampToDate(data.createdAt),
        updatedAt: timestampToDate(data.updatedAt),
      };
    });
  } catch (error) {
    console.error('❌ Failed to fetch cohorts:', error);
    throw error;
  }
}

export async function getUserCohorts(userId: string, organizationId?: string): Promise<string[]> {
  logFirestoreOperation('READ', COHORTS_COLLECTION, { userId, organizationId });

  const constraints: QueryConstraint[] = [
    where('employeeIds', 'array-contains', userId),
  ];

  if (organizationId) {
    constraints.push(where('organization', '==', organizationId));
  }

  const q = query(collection(db, COHORTS_COLLECTION), ...constraints);

  try {
    const querySnapshot = await getDocs(q);
    const cohortIds = querySnapshot.docs.map((docSnap) => docSnap.id);
    console.log(`✅ Found ${cohortIds.length} cohorts for user ${userId}`);
    return cohortIds;
  } catch (error) {
    console.error('❌ Failed to fetch user cohorts:', error);
    throw error;
  }
}

export async function updateCohort(
  cohortId: string,
  data: {
    name?: string;
    description?: string;
    employeeIds?: string[];
    organization?: string;
  }
): Promise<void> {
  const docRef = doc(db, COHORTS_COLLECTION, cohortId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteCohort(cohortId: string): Promise<void> {
  const docRef = doc(db, COHORTS_COLLECTION, cohortId);
  await deleteDoc(docRef);
}

export async function addEmployeeToCohort(cohortId: string, employeeId: string): Promise<void> {
  const cohort = await getCohort(cohortId);
  if (!cohort) throw new Error('Cohort not found');

  const employeeIds = cohort.employeeIds || [];
  if (!employeeIds.includes(employeeId)) {
    await updateCohort(cohortId, {
      employeeIds: [...employeeIds, employeeId],
    });
  }
}

export async function removeEmployeeFromCohort(cohortId: string, employeeId: string): Promise<void> {
  const cohort = await getCohort(cohortId);
  if (!cohort) throw new Error('Cohort not found');

  const employeeIds = cohort.employeeIds || [];
  await updateCohort(cohortId, {
    employeeIds: employeeIds.filter((id: string) => id !== employeeId),
  });
}

/**
 * Update user's cohortIds field directly
 * This maintains a denormalized copy of cohort membership on the user document
 * for faster queries without needing to scan all cohorts
 */
export async function updateUserCohorts(userId: string, cohortIds: string[]): Promise<void> {
  logFirestoreOperation('UPDATE', USERS_COLLECTION, { userId, cohortIds });

  const userRef = doc(db, USERS_COLLECTION, userId);

  try {
    await updateDoc(userRef, {
      cohortIds: cohortIds.length > 0 ? cohortIds : deleteField(),
      updatedAt: Timestamp.now(),
    });
    console.log(`✅ Updated cohorts for user ${userId}:`, cohortIds);
  } catch (error) {
    console.error('❌ Failed to update user cohorts:', error);
    throw error;
  }
}

// ============================================
// INVITATION MANAGEMENT
// ============================================

/**
 * Generate a unique invite token (UUID v4)
 */
function generateInviteToken(): string {
  return crypto.randomUUID();
}

/**
 * Create a new invitation and Firebase Auth account
 *
 * This function:
 * 1. Generates a temporary password
 * 2. Creates a Firebase Auth account for the invited user
 * 3. Creates a user profile in Firestore
 * 4. Creates an invitation document with encrypted temp password
 * 5. Returns the invitation ID and temp password (for email)
 */
export async function createInvitation(data: {
  organizationId: string;
  organizationName: string;
  email: string;
  role: 'employee' | 'admin';
  department?: string;
  cohortIds?: string[];
  invitedBy: string;
  inviteeName?: string;
}): Promise<{ invitationId: string; passwordResetLink: string }> {
  logFirestoreOperation('CREATE', INVITATIONS_COLLECTION, {
    email: data.email,
    role: data.role,
    organizationId: data.organizationId,
  });

  const normalizedEmail = data.email.toLowerCase();
  const token = generateInviteToken();
  const now = Timestamp.now();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  try {
    // Step 1: Create Firebase Auth account, Firestore user document, and password reset link using Cloud Function
    // This runs server-side with admin privileges, bypassing Firestore security rules
    console.log('[createInvitation] Creating Firebase Auth account and user document for:', normalizedEmail);

    const createEmployeeAccount = httpsCallable<
      { email: string; role: string; name: string; organization: string; department?: string },
      { success: boolean; userId: string; passwordResetLink: string }
    >(functions, 'createEmployeeAccount');

    const result = await createEmployeeAccount({
      email: normalizedEmail,
      role: data.role,
      name: data.inviteeName || normalizedEmail,
      organization: data.organizationId,
      department: data.department,
    });

    const userId = result.data.userId;
    console.log('✅ Firebase Auth account and Firestore user document created:', userId);

    // Step 2: Add user to cohorts if specified
    if (data.cohortIds && data.cohortIds.length > 0) {
      const batch = writeBatch(db);

      for (const cohortId of data.cohortIds) {
        const cohortRef = doc(db, COHORTS_COLLECTION, cohortId);
        const cohortDoc = await getDoc(cohortRef);

        if (cohortDoc.exists()) {
          const cohortData = cohortDoc.data();
          const currentEmployeeIds = cohortData.employeeIds || [];

          if (!currentEmployeeIds.includes(userId)) {
            batch.update(cohortRef, {
              employeeIds: [...currentEmployeeIds, userId]
            });
          }
        }
      }

      await batch.commit();
      console.log('✅ User added to cohorts');
    }

    // Step 3: Create invitation document
    const invitationDoc: Omit<Invitation, 'id'> = {
      organizationId: data.organizationId,
      organizationName: data.organizationName,
      email: normalizedEmail,
      role: data.role,
      department: data.department,
      cohortIds: data.cohortIds,
      token,
      status: 'pending',
      invitedBy: data.invitedBy,
      expiresAt: expiresAt as any,
      createdAt: now as any,
      userId: userId, // Link to Firebase Auth account
      passwordResetLink: result.data.passwordResetLink, // Password reset link from Cloud Function
      passwordChanged: false, // Will be set to true when user changes password
      metadata: data.inviteeName ? { inviteeName: data.inviteeName } : undefined,
    };

    const cleanInvitationDoc = removeUndefined(invitationDoc) as Omit<Invitation, 'id'>;
    const docRef = await addDoc(collection(db, INVITATIONS_COLLECTION), cleanInvitationDoc);

    console.log('✅ Invitation created successfully:', docRef.id);

    // Return invitation ID and password reset link
    return {
      invitationId: docRef.id,
      passwordResetLink: result.data.passwordResetLink,
    };

  } catch (error: any) {
    console.error('❌ Failed to create invitation:', error);

    // Handle specific errors from Cloud Function or Firestore
    if (error.message?.includes('email already exists')) {
      throw new Error(`The email ${normalizedEmail} is already registered. Please use a different email address.`);
    } else if (error.message?.includes('Invalid email')) {
      throw new Error('Invalid email address format.');
    }

    throw error;
  }
}

/**
 * Get invitation by token (for public invite accept page)
 */
export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  logFirestoreOperation('READ', INVITATIONS_COLLECTION, { token });

  const q = query(
    collection(db, INVITATIONS_COLLECTION),
    where('token', '==', token)
  );

  try {
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('❌ Invitation not found with token:', token);
      return null;
    }

    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();

    const invitation: Invitation = {
      id: docSnap.id,
      organizationId: data.organizationId,
      organizationName: data.organizationName,
      email: data.email,
      role: data.role,
      department: data.department,
      cohortIds: data.cohortIds,
      token: data.token,
      status: data.status,
      invitedBy: data.invitedBy,
      expiresAt: timestampToDate(data.expiresAt),
      createdAt: timestampToDate(data.createdAt),
      acceptedAt: data.acceptedAt ? timestampToDate(data.acceptedAt) : undefined,
      userId: data.userId, // Firebase Auth User ID
      passwordChanged: data.passwordChanged, // Has user changed password
      metadata: data.metadata,
    };

    // Check if invitation is expired
    const now = new Date();
    if (invitation.status === 'pending' && new Date(invitation.expiresAt) < now) {
      // Mark as expired
      await updateInvitationStatus(docSnap.id, 'expired');
      invitation.status = 'expired';
    }

    console.log('✅ Invitation found:', docSnap.id);
    return invitation;
  } catch (error) {
    console.error('❌ Failed to fetch invitation:', error);
    throw error;
  }
}

/**
 * Get invitation by ID
 */
export async function getInvitation(invitationId: string): Promise<Invitation | null> {
  const docRef = doc(db, INVITATIONS_COLLECTION, invitationId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  return {
    id: docSnap.id,
    organizationId: data.organizationId,
    organizationName: data.organizationName,
    email: data.email,
    role: data.role,
    department: data.department,
    cohortIds: data.cohortIds,
    token: data.token,
    status: data.status,
    invitedBy: data.invitedBy,
    expiresAt: timestampToDate(data.expiresAt),
    createdAt: timestampToDate(data.createdAt),
    acceptedAt: data.acceptedAt ? timestampToDate(data.acceptedAt) : undefined,
    metadata: data.metadata,
  };
}

/**
 * Get all invitations for an organization
 */
export async function getOrganizationInvitations(
  organizationId: string,
  statusFilter?: InvitationStatus
): Promise<Invitation[]> {
  logFirestoreOperation('QUERY', INVITATIONS_COLLECTION, { organizationId, status: statusFilter });

  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];

  if (statusFilter) {
    constraints.unshift(where('status', '==', statusFilter));
  }

  const q = query(collection(db, INVITATIONS_COLLECTION), ...constraints);

  try {
    const querySnapshot = await getDocs(q);
    const invitations = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        organizationId: data.organizationId,
        organizationName: data.organizationName,
        email: data.email,
        role: data.role,
        department: data.department,
        cohortIds: data.cohortIds,
        token: data.token,
        status: data.status,
        invitedBy: data.invitedBy,
        expiresAt: timestampToDate(data.expiresAt),
        createdAt: timestampToDate(data.createdAt),
        acceptedAt: data.acceptedAt ? timestampToDate(data.acceptedAt) : undefined,
        metadata: data.metadata,
      };
    });

    console.log(`✅ Found ${invitations.length} invitations for organization ${organizationId}`);
    return invitations;
  } catch (error) {
    console.error('❌ Failed to fetch invitations:', error);
    throw error;
  }
}

/**
 * Update invitation status (pending → accepted/expired)
 */
export async function updateInvitationStatus(
  invitationId: string,
  status: InvitationStatus
): Promise<void> {
  logFirestoreOperation('UPDATE', INVITATIONS_COLLECTION, { id: invitationId, status });

  const docRef = doc(db, INVITATIONS_COLLECTION, invitationId);
  const updateData: any = { status };

  if (status === 'accepted') {
    updateData.acceptedAt = Timestamp.now();
  }

  await updateDoc(docRef, updateData);
  console.log(`✅ Invitation status updated to ${status}:`, invitationId);
}

/**
 * Revoke (delete) an invitation
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  logFirestoreOperation('DELETE', INVITATIONS_COLLECTION, { id: invitationId });

  const docRef = doc(db, INVITATIONS_COLLECTION, invitationId);
  await deleteDoc(docRef);

  console.log(`✅ Invitation revoked:`, invitationId);
}

/**
 * Resend invitation (generates new token and extends expiry)
 */
export async function resendInvitation(invitationId: string): Promise<string> {
  logFirestoreOperation('UPDATE', INVITATIONS_COLLECTION, { id: invitationId, action: 'resend' });

  const newToken = generateInviteToken();
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  const docRef = doc(db, INVITATIONS_COLLECTION, invitationId);
  await updateDoc(docRef, {
    token: newToken,
    expiresAt: newExpiresAt as any,
    status: 'pending', // Reset to pending if it was expired
  });

  console.log(`✅ Invitation resent with new token:`, invitationId);
  return newToken;
}

/**
 * Check if an email already has a pending invitation
 */
export async function checkPendingInvitation(
  email: string,
  organizationId: string
): Promise<Invitation | null> {
  const q = query(
    collection(db, INVITATIONS_COLLECTION),
    where('email', '==', email.toLowerCase()),
    where('organizationId', '==', organizationId),
    where('status', '==', 'pending')
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  const docSnap = querySnapshot.docs[0];
  const data = docSnap.data();

  return {
    id: docSnap.id,
    organizationId: data.organizationId,
    organizationName: data.organizationName,
    email: data.email,
    role: data.role,
    department: data.department,
    cohortIds: data.cohortIds,
    token: data.token,
    status: data.status,
    invitedBy: data.invitedBy,
    expiresAt: timestampToDate(data.expiresAt),
    createdAt: timestampToDate(data.createdAt),
    acceptedAt: data.acceptedAt ? timestampToDate(data.acceptedAt) : undefined,
    metadata: data.metadata,
  };
}

// ============================================
// CAMPAIGN ENROLLMENT MANAGEMENT
// ============================================

/**
 * Enroll a user in a campaign
 */
export async function enrollUserInCampaign(
  campaignId: string,
  userId: string,
  organizationId: string,
  enrolledBy?: string,
  autoEnrolled: boolean = false
): Promise<string> {
  logFirestoreOperation('CREATE', CAMPAIGN_ENROLLMENTS_COLLECTION, {
    campaignId,
    userId,
    organizationId,
  });

  // Check if enrollment already exists
  const existing = await checkUserEnrollment(campaignId, userId);
  if (existing) {
    console.log('⚠️ User already enrolled in campaign:', existing.id);
    return existing.id;
  }

  const totalModules = await fetchCampaignModuleCount(campaignId);

  const enrollmentDoc: Omit<CampaignEnrollment, 'id'> = {
    campaignId,
    userId,
    organizationId,
    status: 'not-started',
    enrolledAt: Timestamp.now() as any,
    accessCount: 0,
    totalModules,
    completedModules: 0,
    moduleProgress: {},
    metadata: {
      enrolledBy,
      autoEnrolled,
    },
  };

  try {
    const docRef = await addDoc(collection(db, CAMPAIGN_ENROLLMENTS_COLLECTION), enrollmentDoc);
    console.log('✅ Campaign enrollment created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Failed to create enrollment:', error);
    throw error;
  }
}

/**
 * Check if a user is enrolled in a campaign
 */
export async function checkUserEnrollment(
  campaignId: string,
  userId: string
): Promise<CampaignEnrollment | null> {
  const q = query(
    collection(db, CAMPAIGN_ENROLLMENTS_COLLECTION),
    where('campaignId', '==', campaignId),
    where('userId', '==', userId)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  const docSnap = querySnapshot.docs[0];
  return buildEnrollmentFromData(docSnap.id, docSnap.data());
}

/**
 * Get all enrollments for a campaign
 */
export async function getCampaignEnrollments(campaignId: string): Promise<CampaignEnrollment[]> {
  logFirestoreOperation('QUERY', CAMPAIGN_ENROLLMENTS_COLLECTION, { campaignId });

  const q = query(
    collection(db, CAMPAIGN_ENROLLMENTS_COLLECTION),
    where('campaignId', '==', campaignId),
    orderBy('enrolledAt', 'desc')
  );

  try {
    const querySnapshot = await getDocs(q);
    const enrollments = querySnapshot.docs.map((docSnap) =>
      buildEnrollmentFromData(docSnap.id, docSnap.data())
    );

    console.log(`✅ Found ${enrollments.length} enrollments for campaign ${campaignId}`);
    return enrollments;
  } catch (error) {
    console.error('❌ Failed to fetch enrollments:', error);
    throw error;
  }
}

/**
 * Get all enrollments for a user
 */
export async function getUserEnrollments(userId: string): Promise<CampaignEnrollment[]> {
  logFirestoreOperation('QUERY', CAMPAIGN_ENROLLMENTS_COLLECTION, { userId });

  const q = query(
    collection(db, CAMPAIGN_ENROLLMENTS_COLLECTION),
    where('userId', '==', userId),
    orderBy('enrolledAt', 'desc')
  );

  try {
    const querySnapshot = await getDocs(q);
    const enrollments = querySnapshot.docs.map((docSnap) =>
      buildEnrollmentFromData(docSnap.id, docSnap.data())
    );

    console.log(`✅ Found ${enrollments.length} enrollments for user ${userId}`);
    return enrollments;
  } catch (error) {
    console.error('❌ Failed to fetch user enrollments:', error);
    throw error;
  }
}

/**
 * Update enrollment status and access tracking
 */
export async function updateEnrollmentAccess(
  campaignId: string,
  userId: string
): Promise<void> {
  const enrollment = await checkUserEnrollment(campaignId, userId);
  if (!enrollment) {
    throw new Error('Enrollment not found');
  }

  const docRef = doc(db, CAMPAIGN_ENROLLMENTS_COLLECTION, enrollment.id);
  const updates: any = {
    accessCount: (enrollment.accessCount || 0) + 1,
    lastAccessedAt: Timestamp.now(),
  };

  // If first access, mark as started
  if (enrollment.status === 'not-started') {
    updates.status = 'in-progress';
    updates.startedAt = Timestamp.now();
  }

  if (!enrollment.totalModules || enrollment.totalModules === 0) {
    updates.totalModules = await fetchCampaignModuleCount(campaignId);
  }

  await updateDoc(docRef, updates);
  console.log('✅ Enrollment access updated:', enrollment.id);
}

async function updateModuleProgressState(
  campaignId: string,
  userId: string,
  itemId: string,
  options: {
    markVideoFinished?: boolean;
    incrementQuestions?: number;
    questionTarget?: number;
    questionId?: string;
  }
): Promise<void> {
  const enrollment = await checkUserEnrollment(campaignId, userId);
  if (!enrollment) {
    throw new Error('Enrollment not found');
  }

  const docRef = doc(db, CAMPAIGN_ENROLLMENTS_COLLECTION, enrollment.id);
  const now = Timestamp.now();

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists()) {
      throw new Error('Enrollment not found');
    }

    const currentEnrollment = buildEnrollmentFromData(snapshot.id, snapshot.data());
    const totalModules = await resolveEnrollmentTotalModules(currentEnrollment);
    const moduleProgress = { ...(currentEnrollment.moduleProgress || {}) };
    const existing = moduleProgress[itemId];
    const questionTarget = Math.max(
      0,
      options.questionTarget ?? existing?.questionTarget ?? DEFAULT_MODULE_QUESTION_TARGET
    );

    const answeredIds = new Set(existing?.answeredQuestionIds || []);
    const updatedProgress: ModuleProgress = {
      videoFinished: existing?.videoFinished ?? false,
      questionsAnswered: existing?.questionsAnswered ?? 0,
      questionTarget,
      completed: existing?.completed ?? false,
      completedAt: existing?.completedAt,
      answeredQuestionIds: existing?.answeredQuestionIds,
    };

    if (options.markVideoFinished) {
      updatedProgress.videoFinished = true;
    }

    if (options.incrementQuestions && options.incrementQuestions > 0) {
      let shouldIncrement = true;
      if (options.questionId) {
        if (answeredIds.has(options.questionId)) {
          shouldIncrement = false;
        } else {
          answeredIds.add(options.questionId);
          updatedProgress.answeredQuestionIds = Array.from(answeredIds);
        }
      }

      if (shouldIncrement) {
        updatedProgress.questionsAnswered = Math.min(
          updatedProgress.questionTarget,
          updatedProgress.questionsAnswered + options.incrementQuestions
        );
      }
    }

    // Ensure question target stays in sync
    updatedProgress.questionTarget = questionTarget;

    if (
      !updatedProgress.completed &&
      updatedProgress.videoFinished &&
      updatedProgress.questionsAnswered >= updatedProgress.questionTarget
    ) {
      updatedProgress.completed = true;
      updatedProgress.completedAt = new Date();
    }

    moduleProgress[itemId] = updatedProgress;

    const completedModules = countCompletedModules(moduleProgress);

    const updates: Record<string, any> = {
      moduleProgress: serializeModuleProgressData(moduleProgress),
      completedModules,
      lastAccessedAt: now,
    };

    if (!currentEnrollment.totalModules || currentEnrollment.totalModules !== totalModules) {
      updates.totalModules = totalModules;
    }

    // Promote to in-progress on any activity
    if (currentEnrollment.status === 'not-started') {
      updates.status = 'in-progress';
      updates.startedAt = currentEnrollment.startedAt ?? now;
    }

    // Recalculate status based on completion counts
    if (totalModules > 0 && completedModules >= totalModules) {
      updates.status = 'completed';
      updates.completedAt = currentEnrollment.completedAt ?? now;
    } else if (currentEnrollment.status === 'completed') {
      updates.status = 'in-progress';
      updates.completedAt = null;
    }

    transaction.update(docRef, updates);
  });
}

export async function setModuleVideoFinished(
  campaignId: string,
  userId: string,
  itemId: string,
  questionTargetOrOptions: number | { questionTarget?: number; watchedDuration?: number; totalDuration?: number; forceComplete?: boolean } = DEFAULT_MODULE_QUESTION_TARGET
): Promise<void> {
  const options =
    typeof questionTargetOrOptions === 'number'
      ? { questionTarget: questionTargetOrOptions }
      : questionTargetOrOptions;

  const questionTarget = options.questionTarget ?? DEFAULT_MODULE_QUESTION_TARGET;
  const hasDuration =
    typeof options.watchedDuration === 'number' &&
    typeof options.totalDuration === 'number' &&
    options.totalDuration > 0;
  const meetsThreshold = hasDuration
    ? options.watchedDuration! / options.totalDuration! >= 0.95
    : true;

  await updateModuleProgressState(campaignId, userId, itemId, {
    markVideoFinished: options.forceComplete || meetsThreshold,
    questionTarget,
  });
}

export async function incrementModuleQuestionProgress(
  campaignId: string,
  userId: string,
  itemId: string,
  questionTarget: number = DEFAULT_MODULE_QUESTION_TARGET,
  incrementBy: number = 1,
  questionId?: string
): Promise<void> {
  await updateModuleProgressState(campaignId, userId, itemId, {
    incrementQuestions: incrementBy,
    questionTarget,
    questionId,
  });
}

/**
 * Mark campaign enrollment as completed
 */
export async function markEnrollmentCompleted(
  campaignId: string,
  userId: string
): Promise<void> {
  const enrollment = await checkUserEnrollment(campaignId, userId);
  if (!enrollment) {
    throw new Error('Enrollment not found');
  }

  const docRef = doc(db, CAMPAIGN_ENROLLMENTS_COLLECTION, enrollment.id);
  const totalModules = await resolveEnrollmentTotalModules(enrollment);
  await updateDoc(docRef, {
    status: 'completed',
    completedAt: Timestamp.now(),
    completedModules: totalModules,
  });

  console.log('✅ Enrollment marked as completed:', enrollment.id);
}

// ============================================
// CAMPAIGN PROGRESS TRACKING
// ============================================

/**
 * Update video progress for a user in a campaign
 */
export async function updateVideoProgress(
  campaignId: string,
  userId: string,
  videoId: string,
  organizationId: string,
  watchedDuration: number,
  totalDuration: number
): Promise<void> {
  logFirestoreOperation('UPDATE', CAMPAIGN_PROGRESS_COLLECTION, {
    campaignId,
    userId,
    videoId,
  });

  // Find existing progress document
  const q = query(
    collection(db, CAMPAIGN_PROGRESS_COLLECTION),
    where('campaignId', '==', campaignId),
    where('userId', '==', userId),
    where('videoId', '==', videoId)
  );

  const querySnapshot = await getDocs(q);
  const completed = watchedDuration >= totalDuration * 0.95; // 95% threshold for completion

  if (querySnapshot.empty) {
    // Create new progress document
    const progressDoc: Omit<CampaignProgress, 'id'> = {
      campaignId,
      userId,
      videoId,
      organizationId,
      watchedDuration,
      totalDuration,
      completed,
      lastWatchedAt: Timestamp.now() as any,
      questionsAnswered: [],
      totalQuestions: 0,
      allQuestionsAnswered: false,
      createdAt: Timestamp.now() as any,
      updatedAt: Timestamp.now() as any,
    };

    await addDoc(collection(db, CAMPAIGN_PROGRESS_COLLECTION), progressDoc);
    console.log('✅ Video progress created');
  } else {
    // Update existing progress
    const docRef = doc(db, CAMPAIGN_PROGRESS_COLLECTION, querySnapshot.docs[0].id);
    await updateDoc(docRef, {
      watchedDuration,
      totalDuration,
      completed,
      lastWatchedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log('✅ Video progress updated');
  }
}

/**
 * Update question progress for a video in a campaign
 */
export async function updateQuestionProgress(
  campaignId: string,
  userId: string,
  videoId: string,
  organizationId: string,
  questionId: string,
  totalQuestions: number
): Promise<void> {
  logFirestoreOperation('UPDATE', CAMPAIGN_PROGRESS_COLLECTION, {
    campaignId,
    userId,
    videoId,
    questionId,
  });

  // Find existing progress document
  const q = query(
    collection(db, CAMPAIGN_PROGRESS_COLLECTION),
    where('campaignId', '==', campaignId),
    where('userId', '==', userId),
    where('videoId', '==', videoId)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    // Create new progress document with question answered
    const progressDoc: Omit<CampaignProgress, 'id'> = {
      campaignId,
      userId,
      videoId,
      organizationId,
      watchedDuration: 0,
      totalDuration: 0,
      completed: false,
      lastWatchedAt: Timestamp.now() as any,
      questionsAnswered: [questionId],
      totalQuestions,
      allQuestionsAnswered: totalQuestions === 1,
      createdAt: Timestamp.now() as any,
      updatedAt: Timestamp.now() as any,
    };

    await addDoc(collection(db, CAMPAIGN_PROGRESS_COLLECTION), progressDoc);
    console.log('✅ Question progress created');
  } else {
    // Update existing progress
    const data = querySnapshot.docs[0].data();
    const questionsAnswered = data.questionsAnswered || [];

    if (!questionsAnswered.includes(questionId)) {
      questionsAnswered.push(questionId);
    }

    const docRef = doc(db, CAMPAIGN_PROGRESS_COLLECTION, querySnapshot.docs[0].id);
    await updateDoc(docRef, {
      questionsAnswered,
      totalQuestions,
      allQuestionsAnswered: questionsAnswered.length >= totalQuestions,
      updatedAt: Timestamp.now(),
    });
    console.log('✅ Question progress updated');
  }
}

/**
 * Get campaign progress for a user
 */
export async function getCampaignProgress(
  campaignId: string,
  userId: string
): Promise<CampaignProgress[]> {
  logFirestoreOperation('QUERY', CAMPAIGN_PROGRESS_COLLECTION, { campaignId, userId });

  const q = query(
    collection(db, CAMPAIGN_PROGRESS_COLLECTION),
    where('campaignId', '==', campaignId),
    where('userId', '==', userId)
  );

  try {
    const querySnapshot = await getDocs(q);
    const progress = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        campaignId: data.campaignId,
        userId: data.userId,
        videoId: data.videoId,
        organizationId: data.organizationId,
        watchedDuration: data.watchedDuration,
        totalDuration: data.totalDuration,
        completed: data.completed,
        lastWatchedAt: timestampToDate(data.lastWatchedAt),
        questionsAnswered: data.questionsAnswered || [],
        totalQuestions: data.totalQuestions || 0,
        allQuestionsAnswered: data.allQuestionsAnswered || false,
        createdAt: timestampToDate(data.createdAt),
        updatedAt: timestampToDate(data.updatedAt),
      };
    });

    console.log(`✅ Found ${progress.length} progress records for campaign ${campaignId}`);
    return progress;
  } catch (error) {
    console.error('❌ Failed to fetch campaign progress:', error);
    throw error;
  }
}

/**
 * Check if user has completed all videos and questions in a campaign
 */
export async function checkCampaignCompletion(
  campaignId: string,
  userId: string
): Promise<boolean> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return false;

  const progress = await getCampaignProgress(campaignId, userId);

  // Check if all videos are completed
  const totalVideos = campaign.items.length;
  const completedVideos = progress.filter((p) => p.completed && p.allQuestionsAnswered);

  return completedVideos.length >= totalVideos;
}

// ============================================
// CAMPAIGN RESPONSE STORAGE
// ============================================

/**
 * Save a user's answer to a campaign question
 * Only saves if the user hasn't answered this question before (one answer per question per user)
 */
export async function saveCampaignResponse(
  campaignId: string,
  videoId: string,
  questionId: string,
  userId: string,
  organizationId: string,
  answer: string | number | boolean,
  metadata?: { questionType?: string; questionText?: string }
): Promise<string | null> {
  logFirestoreOperation('CREATE', CAMPAIGN_RESPONSES_COLLECTION, {
    campaignId,
    userId,
    videoId,
    questionId,
  });

  try {
    // Check if user has already answered this question
    const existingResponseQuery = query(
      collection(db, CAMPAIGN_RESPONSES_COLLECTION),
      where('campaignId', '==', campaignId),
      where('userId', '==', userId),
      where('questionId', '==', questionId)
    );

    const existingSnapshot = await getDocs(existingResponseQuery);

    if (!existingSnapshot.empty) {
      console.log('⚠️ Response already exists for this question, skipping save:', {
        campaignId,
        userId,
        questionId,
        existingResponseId: existingSnapshot.docs[0].id
      });
      return existingSnapshot.docs[0].id; // Return existing response ID
    }

    // No existing response, create new one
    const responseDoc: Omit<CampaignResponse, 'id'> = {
      campaignId,
      videoId,
      questionId,
      userId,
      organizationId,
      answer,
      answeredAt: Timestamp.now() as any,
      metadata,
    };

    const docRef = await addDoc(collection(db, CAMPAIGN_RESPONSES_COLLECTION), responseDoc);
    console.log('✅ Campaign response saved:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Failed to save response:', error);
    throw error;
  }
}

/**
 * Get all responses for a campaign (admin analytics)
 */
export async function getCampaignResponses(campaignId: string, organizationId?: string): Promise<CampaignResponse[]> {
  logFirestoreOperation('QUERY', CAMPAIGN_RESPONSES_COLLECTION, { campaignId, organizationId });

  const constraints: QueryConstraint[] = [
    where('campaignId', '==', campaignId),
    orderBy('answeredAt', 'desc')
  ];

  if (organizationId) {
    constraints.push(where('organizationId', '==', organizationId));
  }

  const q = query(
    collection(db, CAMPAIGN_RESPONSES_COLLECTION),
    ...constraints
  );

  try {
    const querySnapshot = await getDocs(q);
    const responses = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        campaignId: data.campaignId,
        videoId: data.videoId,
        questionId: data.questionId,
        userId: data.userId,
        organizationId: data.organizationId,
        answer: data.answer,
        answeredAt: timestampToDate(data.answeredAt),
        metadata: data.metadata,
      };
    });

    console.log(`✅ Found ${responses.length} responses for campaign ${campaignId}`);
    return responses;
  } catch (error) {
    console.error('❌ Failed to fetch responses:', error);
    throw error;
  }
}

/**
 * Get responses for a specific user in a campaign
 */
export async function getUserCampaignResponses(
  campaignId: string,
  userId: string
): Promise<CampaignResponse[]> {
  logFirestoreOperation('QUERY', CAMPAIGN_RESPONSES_COLLECTION, { campaignId, userId });

  const q = query(
    collection(db, CAMPAIGN_RESPONSES_COLLECTION),
    where('campaignId', '==', campaignId),
    where('userId', '==', userId),
    orderBy('answeredAt', 'asc')
  );

  try {
    const querySnapshot = await getDocs(q);
    const responses = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        campaignId: data.campaignId,
        videoId: data.videoId,
        questionId: data.questionId,
        userId: data.userId,
        organizationId: data.organizationId,
        answer: data.answer,
        answeredAt: timestampToDate(data.answeredAt),
        metadata: data.metadata,
      };
    });

    console.log(`✅ Found ${responses.length} responses for user ${userId}`);
    return responses;
  } catch (error) {
    console.error('❌ Failed to fetch user responses:', error);
    throw error;
  }
}

// ============================================
// CAMPAIGN NOTIFICATION QUEUE
// ============================================

/**
 * Queue a notification to be sent
 */
export async function queueNotification(
  campaignId: string,
  userId: string,
  organizationId: string,
  type: NotificationType,
  recipientEmail: string,
  scheduledFor: Date,
  metadata?: { campaignTitle?: string; userName?: string }
): Promise<string> {
  logFirestoreOperation('CREATE', CAMPAIGN_NOTIFICATIONS_COLLECTION, {
    campaignId,
    userId,
    type,
  });

  const notificationDoc: Omit<CampaignNotification, 'id'> = {
    campaignId,
    userId,
    organizationId,
    type,
    status: 'pending',
    recipientEmail,
    scheduledFor: scheduledFor as any,
    retryCount: 0,
    metadata,
    createdAt: Timestamp.now() as any,
    updatedAt: Timestamp.now() as any,
  };

  try {
    const docRef = await addDoc(collection(db, CAMPAIGN_NOTIFICATIONS_COLLECTION), notificationDoc);
    console.log('✅ Notification queued:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Failed to queue notification:', error);
    throw error;
  }
}

/**
 * Get pending notifications that need to be sent
 */
export async function getPendingNotifications(limit: number = 100): Promise<CampaignNotification[]> {
  logFirestoreOperation('QUERY', CAMPAIGN_NOTIFICATIONS_COLLECTION, { status: 'pending', limit });

  const q = query(
    collection(db, CAMPAIGN_NOTIFICATIONS_COLLECTION),
    where('status', '==', 'pending'),
    where('scheduledFor', '<=', Timestamp.now()),
    orderBy('scheduledFor', 'asc')
  );

  try {
    const querySnapshot = await getDocs(q);
    const notifications = querySnapshot.docs.slice(0, limit).map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        campaignId: data.campaignId,
        userId: data.userId,
        organizationId: data.organizationId,
        type: data.type,
        status: data.status,
        recipientEmail: data.recipientEmail,
        scheduledFor: timestampToDate(data.scheduledFor),
        sentAt: data.sentAt ? timestampToDate(data.sentAt) : undefined,
        failureReason: data.failureReason,
        retryCount: data.retryCount || 0,
        metadata: data.metadata,
        createdAt: timestampToDate(data.createdAt),
        updatedAt: timestampToDate(data.updatedAt),
      };
    });

    console.log(`✅ Found ${notifications.length} pending notifications`);
    return notifications;
  } catch (error) {
    console.error('❌ Failed to fetch pending notifications:', error);
    throw error;
  }
}

/**
 * Mark notification as sent
 */
export async function markNotificationSent(notificationId: string): Promise<void> {
  logFirestoreOperation('UPDATE', CAMPAIGN_NOTIFICATIONS_COLLECTION, {
    id: notificationId,
    status: 'sent',
  });

  const docRef = doc(db, CAMPAIGN_NOTIFICATIONS_COLLECTION, notificationId);
  await updateDoc(docRef, {
    status: 'sent',
    sentAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  console.log('✅ Notification marked as sent:', notificationId);
}

/**
 * Mark notification as failed
 */
export async function markNotificationFailed(
  notificationId: string,
  failureReason: string
): Promise<void> {
  logFirestoreOperation('UPDATE', CAMPAIGN_NOTIFICATIONS_COLLECTION, {
    id: notificationId,
    status: 'failed',
  });

  const notification = await getDoc(doc(db, CAMPAIGN_NOTIFICATIONS_COLLECTION, notificationId));
  const retryCount = (notification.data()?.retryCount || 0) + 1;

  const docRef = doc(db, CAMPAIGN_NOTIFICATIONS_COLLECTION, notificationId);
  await updateDoc(docRef, {
    status: 'failed',
    failureReason,
    retryCount,
    updatedAt: Timestamp.now(),
  });

  console.log('✅ Notification marked as failed:', notificationId);
}

// ============================================
// ACCESS CONTROL
// ============================================

/**
 * Check if user can access campaign based on one-time access rules
 */
export async function canUserAccessCampaign(
  campaignId: string,
  userId: string
): Promise<{ canAccess: boolean; reason?: string }> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    return { canAccess: false, reason: 'Campaign not found' };
  }

  // Check if campaign has access control enabled
  if (!campaign.accessControl?.oneTimeAccess) {
    return { canAccess: true };
  }

  const enrollment = await checkUserEnrollment(campaignId, userId);
  if (!enrollment) {
    return { canAccess: true }; // First time access
  }

  const maxAccess = campaign.accessControl.maxAccessCount || 1;
  if (enrollment.accessCount >= maxAccess) {
    return {
      canAccess: false,
      reason: `Maximum access limit (${maxAccess}) reached`,
    };
  }

  return { canAccess: true };
}

// ============================================
// RECURRING CAMPAIGNS
// ============================================

/**
 * Create a new campaign instance for recurring campaigns
 */
export async function createCampaignInstance(
  parentCampaignId: string,
  organizationId: string,
  instanceNumber: number,
  startDate: Date,
  endDate: Date
): Promise<string> {
  logFirestoreOperation('CREATE', CAMPAIGN_INSTANCES_COLLECTION, {
    parentCampaignId,
    instanceNumber,
  });

  const instanceDoc: Omit<CampaignInstance, 'id'> = {
    parentCampaignId,
    organizationId,
    instanceNumber,
    startDate: startDate as any,
    endDate: endDate as any,
    createdAt: Timestamp.now() as any,
    stats: {
      totalEnrollments: 0,
      completedCount: 0,
      inProgressCount: 0,
      notStartedCount: 0,
    },
  };

  try {
    const docRef = await addDoc(collection(db, CAMPAIGN_INSTANCES_COLLECTION), instanceDoc);
    console.log('✅ Campaign instance created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Failed to create campaign instance:', error);
    throw error;
  }
}

/**
 * Get all instances of a recurring campaign
 */
export async function getCampaignInstances(
  parentCampaignId: string
): Promise<CampaignInstance[]> {
  logFirestoreOperation('QUERY', CAMPAIGN_INSTANCES_COLLECTION, { parentCampaignId });

  const q = query(
    collection(db, CAMPAIGN_INSTANCES_COLLECTION),
    where('parentCampaignId', '==', parentCampaignId),
    orderBy('instanceNumber', 'desc')
  );

  try {
    const querySnapshot = await getDocs(q);
    const instances = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        parentCampaignId: data.parentCampaignId,
        organizationId: data.organizationId,
        instanceNumber: data.instanceNumber,
        startDate: timestampToDate(data.startDate),
        endDate: timestampToDate(data.endDate),
        createdAt: timestampToDate(data.createdAt),
        stats: data.stats || {
          totalEnrollments: 0,
          completedCount: 0,
          inProgressCount: 0,
          notStartedCount: 0,
        },
      };
    });

    console.log(`✅ Found ${instances.length} instances for campaign ${parentCampaignId}`);
    return instances;
  } catch (error) {
    console.error('❌ Failed to fetch campaign instances:', error);
    throw error;
  }
}

// ============================================
// USER STATISTICS
// ============================================

/**
 * Get user statistics for the profile page
 */
export async function getUserStats(userId: string): Promise<{
  averageScore: number;
  currentStreak: number;
  totalLearningHours: number;
}> {
  try {
    // 1. Calculate Total Learning Hours from CampaignProgress
    const progressQuery = query(
      collection(db, CAMPAIGN_PROGRESS_COLLECTION),
      where('userId', '==', userId)
    );
    const progressSnap = await getDocs(progressQuery);
    let totalSeconds = 0;
    const activeDates = new Set<string>();

    progressSnap.forEach((doc) => {
      const data = doc.data();
      totalSeconds += data.watchedDuration || 0;

      if (data.lastWatchedAt) {
        const date = data.lastWatchedAt.toDate().toISOString().split('T')[0];
        activeDates.add(date);
      }
    });

    const totalLearningHours = Math.round((totalSeconds / 3600) * 10) / 10;

    // 2. Calculate Current Streak
    const sortedDates = Array.from(activeDates).sort().reverse();
    let currentStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (sortedDates.length > 0 && (sortedDates[0] === today || sortedDates[0] === yesterday)) {
      currentStreak = 1;
      let lastDate = new Date(sortedDates[0]);

      for (let i = 1; i < sortedDates.length; i++) {
        const currentDate = new Date(sortedDates[i]);
        const diffTime = Math.abs(lastDate.getTime() - currentDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          currentStreak++;
          lastDate = currentDate;
        } else {
          break;
        }
      }
    }

    // 3. Calculate Average Score from CampaignResponses
    const responsesQuery = query(
      collection(db, CAMPAIGN_RESPONSES_COLLECTION),
      where('userId', '==', userId)
    );
    const responsesSnap = await getDocs(responsesQuery);
    let totalScore = 0;
    let scoreCount = 0;

    responsesSnap.forEach((doc) => {
      const data = doc.data();
      if (typeof data.answer === 'number') {
        totalScore += data.answer;
        scoreCount++;
      }
    });

    const averageScore = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : 0;

    return {
      averageScore,
      currentStreak,
      totalLearningHours
    };

  } catch (error) {
    console.error('Error calculating user stats:', error);
    return {
      averageScore: 0,
      currentStreak: 0,
      totalLearningHours: 0
    };
  }
}
