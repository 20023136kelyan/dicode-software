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
  limit as firestoreLimit,
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
  UserStreak,
  UserStreakSummary,
  StreakEvent,
  StreakStatus,
  QuestionType,
  UserRole,
  SkillAssessment,
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
const ORGANIZATION_ACTIVITIES_COLLECTION = 'organizationActivities';
export const CAMPAIGN_RESPONSES_COLLECTION = 'campaignResponses';
const CAMPAIGN_NOTIFICATIONS_COLLECTION = 'campaignNotifications';
const ORGANIZATION_NOTIFICATIONS_COLLECTION = 'organizationNotifications';
const CAMPAIGN_INSTANCES_COLLECTION = 'campaignInstances';
const SUPPORT_TICKETS_COLLECTION = 'supportTickets';
const USER_STREAKS_COLLECTION = 'userStreaks';
const STREAK_EVENTS_COLLECTION = 'streakEvents';

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
        // Filter out unpublished DiCode campaigns (only show published templates)
        if (campaign.source === 'dicode' && !campaign.metadata.isPublished) {
          continue;
        }

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
  userCohortIds?: string[],
  userRole?: UserRole
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

      // DiCode campaigns require explicit enrollment at org level
      // Employees only see DiCode campaigns if they have been enrolled by an admin
      if (campaign.source === 'dicode' && userId) {
        const enrollment = await checkUserEnrollment(campaign.id, userId);
        if (!enrollment) {
          // User is not enrolled in this DiCode campaign, skip it
          continue;
        }
      }

      // Organization-level gate already handled by query; now enforce granular filters
      const { allowedDepartments, allowedEmployeeIds, allowedCohortIds, allowedRoles } = campaign;

      // If user has no organization, no further filters apply
      if (!userOrganization) {
        campaigns.push(campaign);
        continue;
      }

      // Role filter (Strict for Applicants)
      if (userRole === 'applicant') {
        if (!allowedRoles || !allowedRoles.includes('applicant')) {
          continue;
        }
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

  // Instrument: Log Publication Activity
  if (isPublished && auth.currentUser) {
    try {
      const campaign = await getCampaign(campaignId);
      if (campaign) {
        // Log Activity
        await logActivity(
          (auth.currentUser as any).organization || campaign.allowedOrganizations?.[0] || '',
          'campaign_published',
          {
            id: auth.currentUser.uid,
            name: auth.currentUser.displayName || 'Admin'
          },
          { id: campaignId, name: campaign.title }
        );

        // Notify Admins
        await notifyAdmins(
          (auth.currentUser as any).organization || campaign.allowedOrganizations?.[0] || '',
          'campaign_status',
          'Campaign Published',
          `"${campaign.title}" is now live and available to employees.`,
          `/admin/campaigns/${campaignId}`
        );
      }
    } catch (e) {
      console.warn('Failed to log campaign publish activity', e);
    }
  }
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

export async function getAllVideos(userOrganizationId?: string): Promise<Video[]> {
  logFirestoreOperation('READ', VIDEOS_COLLECTION, { userOrganizationId });

  const q = query(
    collection(db, VIDEOS_COLLECTION),
    orderBy('metadata.createdAt', 'desc')
  );

  try {
    const querySnapshot = await getDocs(q);
    console.log(`✅ Found ${querySnapshot.docs.length} total videos`);

    const videos = querySnapshot.docs.map((docSnap) => {
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

    // If no org ID provided (e.g. DiCode admin), return all
    if (!userOrganizationId) {
      return videos;
    }

    // Filter by organization
    return videos.filter(video => {
      // Global videos (no specific allowed orgs)
      if (!video.allowedOrganizations || video.allowedOrganizations.length === 0) {
        return true;
      }
      // Organization-specific videos
      return video.allowedOrganizations.includes(userOrganizationId);
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
  email?: string | null;
  role: 'admin' | 'employee' | 'applicant';
  department?: string | null;
  organization?: string | null;
  name?: string | null;
  avatar?: string | null;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say' | null;
  dateOfBirth?: Date | Timestamp | null;
  requirePasswordChange?: boolean;
  onboardingCompletedAt?: Date | Timestamp | null;
  invitationId?: string | null;
  notificationPreferences?: {
    campaignReminders?: boolean;
    newCampaigns?: boolean;
    streakAlerts?: boolean;
    badgeNotifications?: boolean;
    emailDigest?: boolean;
  } | null;
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
  if (profile.email !== undefined) updateData.email = profile.email;
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

  // Instrument: Log Employee Update (Only if performed by another user/admin)
  if (auth.currentUser && auth.currentUser.uid !== uid) {
    try {
      const organizationId = (auth.currentUser as any).organization || data.organization;
      if (organizationId) {
        const changes: Record<string, any> = {};
        if (profile.department) changes.department = profile.department;
        if (profile.role) changes.role = profile.role;

        // Only log if significant fields changed
        if (Object.keys(changes).length > 0) {
          await logActivity(
            organizationId,
            'employee_updated',
            {
              id: auth.currentUser.uid,
              name: auth.currentUser.displayName || 'Admin',
              avatar: auth.currentUser.photoURL || undefined
            },
            {
              id: uid,
              name: data.name || data.email || 'Unknown User'
            },
            changes
          );

          // Notify Admins
          const changeList = Object.keys(changes).join(', ');
          await notifyAdmins(
            organizationId,
            'organization_update',
            'Employee Updated',
            `Admins updated ${data.name || data.email || 'User'}'s profile: ${changeList}.`,
            `/admin/employees`
          );
        }
      }
    } catch (e) {
      console.warn('Failed to log employee update activity', e);
    }
  }

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
 * Delete a user profile completely (Firebase Auth + Firestore + related data)
 * Uses Cloud Function to delete the Firebase Auth account and clean up all related data
 */
export async function deleteUserProfile(userId: string): Promise<void> {
  logFirestoreOperation('DELETE', USERS_COLLECTION, { id: userId });

  // Instrument: Log Employee Deletion (Get user details first)
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    const userData = userDoc.data();

    if (userData && auth.currentUser) {
      const organizationId = (auth.currentUser as any).organization || userData.organization;
      if (organizationId) {
        await logActivity(
          organizationId,
          'employee_deleted',
          {
            id: auth.currentUser.uid,
            name: auth.currentUser.displayName || 'Admin',
            avatar: auth.currentUser.photoURL || undefined
          },
          {
            id: userId,
            name: userData.name || userData.email || 'Unknown User'
          },
          { role: userData.role, department: userData.department }
        );

        // Notify Admins
        await notifyAdmins(
          organizationId,
          'system_alert',
          'Employee Removed',
          `${userData.name || userData.email || 'Unknown User'} was removed from the organization.`,
          `/admin/employees`
        );
      }
    }
  } catch (e) {
    console.warn('Failed to log employee deletion activity', e);
  }

  const deleteEmployeeAccount = httpsCallable<
    { userId: string },
    { success: boolean; message: string }
  >(functions, 'deleteEmployeeAccount');

  const result = await deleteEmployeeAccount({ userId });

  if (!result.data.success) {
    throw new Error(result.data.message || 'Failed to delete user');
  }

  console.log(`✅ User completely deleted: ${userId}`);
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

    // Instrument: Log Activity
    if (organization && auth.currentUser) {
      try {
        await logActivity(
          organization,
          'cohort_created',
          {
            id: auth.currentUser.uid,
            name: auth.currentUser.displayName || 'Admin',
            avatar: auth.currentUser.photoURL || undefined
          },
          { id: docRef.id, name: name }
        );
      } catch (e) {
        console.warn('Failed to log cohort activity', e);
      }
    }

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
  role: UserRole;
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

    // Instrument: Log Activity
    try {
      let inviterName = 'Admin';
      let inviterAvatar = undefined;
      // Try to fetch inviter details
      const inviterDoc = await getDoc(doc(db, USERS_COLLECTION, data.invitedBy));
      if (inviterDoc.exists()) {
        const d = inviterDoc.data();
        inviterName = d.name || d.email || 'Admin';
        inviterAvatar = d.avatar;
      }

      await logActivity(
        data.organizationId,
        'invitation_sent',
        { id: data.invitedBy, name: inviterName, avatar: inviterAvatar },
        { id: docRef.id, name: normalizedEmail },
        { role: data.role }
      );
    } catch (e) {
      console.warn('Failed to log invitation activity', e);
    }

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

  // Fetch the invitation document to get its current data
  const invitationDoc = await getDoc(docRef);
  if (!invitationDoc.exists()) {
    console.warn('Invitation not found for status update:', invitationId);
    return;
  }
  const invitation = { id: invitationDoc.id, ...invitationDoc.data() } as Invitation;


  if (status === 'accepted') {
    updateData.acceptedAt = Timestamp.now();

    // Instrument: Notify Admins of New User
    try {
      if (invitation.organizationId) {
        // Fetch invitee name if available in metadata or use email
        const inviteeName = invitation.metadata?.inviteeName || invitation.email;
        await notifyAdmins(
          invitation.organizationId,
          'user_joined',
          'New Team Member',
          `${inviteeName} has joined the organization via invitation.`,
          '/admin/employees' // Link to employees page
        );
      }
    } catch (e) {
      console.warn('Failed to notify admins of user join', e);
    }
  }

  await updateDoc(docRef, updateData);
  await updateDoc(docRef, updateData);
  console.log(`✅ Invitation status updated to ${status}:`, invitationId);

  // Instrument: Log Employee Joined
  if (status === 'accepted') {
    try {
      const invitationDoc = await getDoc(docRef);
      if (invitationDoc.exists()) {
        const invData = invitationDoc.data();
        // Actor is the new user (invitee)
        // Target is also the user? Or the Organization? 
        // Let's say Actor = User, Target = Organization (or implicit).
        // But logActivity requires a target. Maybe Target = "The Invitation" or "The Role"?
        // Let's make Target = The User (self)

        let actorName = invData.email; // Fallback
        let actorId = invData.userId || 'unknown';

        if (auth.currentUser) {
          actorName = auth.currentUser.displayName || invData.email;
          actorId = auth.currentUser.uid;
        }

        await logActivity(
          invData.organizationId,
          'invitation_accepted', // Using 'invitation_accepted' instead of 'employee_joined' to match pattern, but mapped to "Employee Joined" in UI
          { id: actorId, name: actorName },
          { id: actorId, name: actorName }, // Target is self joining
          { role: invData.role, department: invData.department }
        );
      }
    } catch (e) {
      console.warn('Failed to log invitation acceptance', e);
    }
  }
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
    // If existing enrollment has empty or different organizationId, update it
    // This handles legacy enrollments created before org-scoping was enforced
    if (organizationId && (!existing.organizationId || existing.organizationId !== organizationId)) {
      console.log('🔄 Updating enrollment organizationId:', existing.id, 'from', existing.organizationId || '(empty)', 'to', organizationId);
      try {
        const enrollmentRef = doc(db, CAMPAIGN_ENROLLMENTS_COLLECTION, existing.id);
        await updateDoc(enrollmentRef, { organizationId });
        console.log('✅ Enrollment organizationId updated');
      } catch (updateError) {
        console.error('❌ Failed to update enrollment organizationId:', updateError);
      }
    } else {
      console.log('⚠️ User already enrolled in campaign:', existing.id);
    }
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

    // Instrument: Log Activity
    try {
      // Resolve Actor
      let actor: { id: string; name: string; avatar?: string } = { id: 'system', name: 'System' };
      if (enrolledBy) {
        // If enrolledBy is provided (ID), try to resolve name, or use ID
        const enrollerDoc = await getDoc(doc(db, USERS_COLLECTION, enrolledBy));
        if (enrollerDoc.exists()) {
          const d = enrollerDoc.data();
          actor = { id: enrolledBy, name: d.name || d.email || 'Admin', avatar: d.avatar };
        } else {
          actor = { id: enrolledBy, name: 'Admin' };
        }
      } else if (autoEnrolled) {
        actor = { id: 'system', name: 'System (Auto)' };
      } else if (auth.currentUser) {
        actor = {
          id: auth.currentUser.uid,
          name: auth.currentUser.displayName || 'Admin',
          avatar: auth.currentUser.photoURL || undefined
        };
      }

      // Resolve Target (User)
      let targetName = 'User';
      const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
      if (userDoc.exists()) {
        const d = userDoc.data();
        targetName = d.name || d.email || 'User';
      }

      // Resolve Campaign Context
      let campaignTitle = 'Campaign';
      const campaignDoc = await getDoc(doc(db, CAMPAIGNS_COLLECTION, campaignId));
      if (campaignDoc.exists()) {
        campaignTitle = campaignDoc.data().title || 'Campaign';
      }

      await logActivity(
        organizationId,
        'campaign_assigned',
        actor,
        { id: userId, name: targetName },
        { campaignId, campaignTitle }
      );

      // Notify Admins
      await notifyAdmins(
        organizationId,
        'organization_update',
        'Campaign Assigned',
        `${actor.name} assigned campaign "${campaignTitle}" to ${targetName}.`,
        `/admin/campaigns/${campaignId}`
      );

    } catch (e) {
      console.warn('Failed to log enrollment activity', e);
    }

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
 * Get all enrollments for a campaign within an organization
 * The organizationId filter is required for Firestore security rules validation
 */
export async function getCampaignEnrollments(
  campaignId: string,
  organizationId: string
): Promise<CampaignEnrollment[]> {
  logFirestoreOperation('QUERY', CAMPAIGN_ENROLLMENTS_COLLECTION, { campaignId, organizationId });

  const q = query(
    collection(db, CAMPAIGN_ENROLLMENTS_COLLECTION),
    where('campaignId', '==', campaignId),
    where('organizationId', '==', organizationId),
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
 * Recent activity item for organization dashboard
 */
export interface RecentActivityItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  action: 'completed' | 'started' | 'in_progress' | 'enrolled' | 'invitation_sent' | 'cohort_created' | 'campaign_published' | 'campaign_assigned' | 'invitation_accepted' | 'employee_deleted' | 'employee_updated';

  campaignId: string;
  campaignTitle: string; // @deprecated use targetName
  targetName?: string;
  department?: string;
  timestamp: Date;
}

export interface OrganizationActivity {
  id: string;
  organizationId: string;
  type: RecentActivityItem['action'];
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  targetId: string;
  targetName: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
}

/**
 * Send a notification to organization admins
 */
export async function notifyAdmins(
  organizationId: string,
  type: OrganizationActivity['type'] | 'system_alert' | 'user_joined' | 'campaign_status' | 'license_limit' | 'organization_update',
  title: string,
  message: string,
  link?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const notificationData = {
      organizationId,
      type,
      title,
      message,
      read: false,
      createdAt: Timestamp.now(),
      link,
      metadata
    };

    // We remove undefined fields
    const cleanData = removeUndefined(notificationData);

    await addDoc(collection(db, ORGANIZATION_NOTIFICATIONS_COLLECTION), cleanData);
    // Silent log
    // console.log(`🔔 Notification sent: ${title}`);
  } catch (e) {
    console.warn('Failed to send admin notification', e);
  }
}

/**
 * Log an organization activity
 */
export async function logActivity(
  organizationId: string,
  type: OrganizationActivity['type'],
  actor: { id: string; name: string; avatar?: string },
  target: { id: string; name: string },
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const activityDoc: Omit<OrganizationActivity, 'id'> = {
      organizationId,
      type,
      actorId: actor.id,
      actorName: actor.name,
      actorAvatar: actor.avatar,
      targetId: target.id,
      targetName: target.name,
      metadata,
      createdAt: Timestamp.now(),
    };

    const cleanDoc = removeUndefined(activityDoc);
    await addDoc(collection(db, ORGANIZATION_ACTIVITIES_COLLECTION), cleanDoc);
    // console.log(`📝 Logged activity: ${type} by ${actor.name}`);
  } catch (error) {
    console.error('❌ Failed to log activity:', error);
    // Don't throw, just log error to prevent blocking main flow
  }
}

/**
 * Get recent activity for an organization
 * Queries unified organizationActivities collection
 */
export async function getRecentOrgActivity(
  organizationId: string,
  limitCount: number = 10
): Promise<RecentActivityItem[]> {
  logFirestoreOperation('QUERY', ORGANIZATION_ACTIVITIES_COLLECTION, { organizationId, limit: limitCount });

  try {
    const q = query(
      collection(db, ORGANIZATION_ACTIVITIES_COLLECTION),
      where('organizationId', '==', organizationId),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limitCount)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map(doc => {
      const data = doc.data() as OrganizationActivity;

      // Map OrganizationActivity to RecentActivityItem
      return {
        id: doc.id,
        userId: data.actorId,
        userName: data.actorName,
        userAvatar: data.actorAvatar,
        action: data.type,
        // For campaign activities, prefer metadata.campaignId, otherwise use targetId
        campaignId: data.metadata?.campaignId || data.targetId || '',
        campaignTitle: data.targetName,
        targetName: data.targetName,
        department: data.metadata?.department,
        timestamp: data.createdAt.toDate(),
      };
    });

  } catch (error) {
    console.error('❌ Failed to fetch recent org activity:', error);
    return [];
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

    // Instrument: Log Started
    try {
      const campaign = await getCampaign(campaignId);
      if (campaign) {
        // Actor = User
        let actorName = 'User';
        if (auth.currentUser) {
          actorName = auth.currentUser.displayName || 'User';
        }

        await logActivity(
          enrollment.organizationId,
          'started',
          { id: userId, name: actorName },
          { id: campaignId, name: campaign.title }
        );
      }
    } catch (e) {
      console.warn('Failed to log campaign start', e);
    }
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
      console.log(`🎬 Video marked as FINISHED for module ${itemId}`);
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

    console.log(`📊 Module Progress Check for ${itemId}: videoFinished=${updatedProgress.videoFinished}, questionsAnswered=${updatedProgress.questionsAnswered}/${updatedProgress.questionTarget}, completed=${updatedProgress.completed}`);

    if (
      !updatedProgress.completed &&
      updatedProgress.videoFinished &&
      updatedProgress.questionsAnswered >= updatedProgress.questionTarget
    ) {
      updatedProgress.completed = true;
      updatedProgress.completedAt = new Date();
      console.log(`✅ Module ${itemId} marked as COMPLETED!`);
    } else if (!updatedProgress.completed) {
      const missing = [];
      if (!updatedProgress.videoFinished) missing.push('video not finished');
      if (updatedProgress.questionsAnswered < updatedProgress.questionTarget) {
        missing.push(`need ${updatedProgress.questionTarget - updatedProgress.questionsAnswered} more questions`);
      }
      console.log(`⏳ Module ${itemId} NOT completed. Missing: ${missing.join(', ')}`);
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
 * Mark campaign enrollment as completed and update streak
 */
export async function markEnrollmentCompleted(
  campaignId: string,
  userId: string
): Promise<{
  streakResult?: {
    streak: UserStreak;
    isNewStreak: boolean;
    milestonesAchieved: number[];
    streakBroken: boolean;
  };
}> {
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

  // Instrument: Log Completed
  try {
    const campaign = await getCampaign(campaignId);
    if (campaign) {
      let actorName = 'User';
      if (auth.currentUser) {
        actorName = auth.currentUser.displayName || 'User';
      }

      await logActivity(
        enrollment.organizationId,
        'completed',
        { id: userId, name: actorName },
        { id: campaignId, name: campaign.title }
      );

      // Notify Admins
      await notifyAdmins(
        enrollment.organizationId,
        'organization_update',
        'Enrollment Completed',
        `${actorName} completed the campaign: "${campaign.title}".`,
        `/admin/campaigns/${campaignId}`
      );
    }
  } catch (e) {
    console.warn('Failed to log campaign completion', e);
  }

  console.log('✅ Enrollment marked as completed:', enrollment.id);
  // NOTE: Streak tracking is now handled by cloud function (onEnrollmentStatusChanged)
  // which triggers when enrollment status changes to 'completed'

  return {};
}

/**
 * Check if a campaign was just completed.
 * NOTE: Streak tracking is now handled by cloud function (onEnrollmentStatusChanged)
 */
export async function checkAndRecordCampaignCompletion(
  campaignId: string,
  userId: string
): Promise<{
  wasCompleted: boolean;
}> {
  const enrollment = await checkUserEnrollment(campaignId, userId);
  if (!enrollment || enrollment.status !== 'completed') {
    return { wasCompleted: false };
  }

  // Streak tracking is now handled server-side by onEnrollmentStatusChanged cloud function
  return { wasCompleted: true };
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
  metadata?: {
    questionType?: string;
    questionText?: string;
    competencyId?: string;
    skillId?: string;
    // Q2 SJT-specific fields
    selectedOptionId?: string;
    intentScore?: number;
  }
): Promise<string | null> {
  logFirestoreOperation('CREATE', CAMPAIGN_RESPONSES_COLLECTION, {
    campaignId,
    userId,
    videoId,
    questionId,
  });

  try {
    // Check if user has already answered this question for this video
    // (questions may have same IDs across different videos)
    const existingResponseQuery = query(
      collection(db, CAMPAIGN_RESPONSES_COLLECTION),
      where('campaignId', '==', campaignId),
      where('userId', '==', userId),
      where('videoId', '==', videoId),
      where('questionId', '==', questionId)
    );

    const existingSnapshot = await getDocs(existingResponseQuery);

    if (!existingSnapshot.empty) {
      console.log('⚠️ Response already exists for this question, skipping save:', {
        campaignId,
        userId,
        videoId,
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
      // Q2 SJT-specific fields at top level for easier querying
      ...(metadata?.selectedOptionId && { selectedOptionId: metadata.selectedOptionId }),
      ...(metadata?.intentScore !== undefined && { intentScore: metadata.intentScore }),
      answeredAt: Timestamp.now() as any,
      metadata: {
        // Only include defined values to avoid Firestore undefined rejection
        ...(metadata?.questionType && { questionType: metadata.questionType as QuestionType }),
        ...(metadata?.questionText && { questionText: metadata.questionText }),
        ...(metadata?.competencyId && { competencyId: metadata.competencyId }),
        ...(metadata?.skillId && { skillId: metadata.skillId }),
      },
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
 * Streak is calculated based on consecutive days of completing campaigns
 */
export async function getUserStats(userId: string): Promise<{
  averageScore: number;
  currentStreak: number;
  totalLearningHours: number;
  completedToday: boolean;
  streakAtRisk: boolean;
  lastCompletionDate: string | null;
}> {
  try {
    // 1. Calculate Total Learning Hours from CampaignProgress
    const progressQuery = query(
      collection(db, CAMPAIGN_PROGRESS_COLLECTION),
      where('userId', '==', userId)
    );
    const progressSnap = await getDocs(progressQuery);
    let totalSeconds = 0;

    progressSnap.forEach((doc) => {
      const data = doc.data();
      totalSeconds += data.watchedDuration || 0;
    });

    const totalLearningHours = Math.round((totalSeconds / 3600) * 10) / 10;

    // 2. Get campaign completion dates from enrollments
    const enrollmentsQuery = query(
      collection(db, CAMPAIGN_ENROLLMENTS_COLLECTION),
      where('userId', '==', userId),
      where('status', '==', 'completed')
    );
    const enrollmentsSnap = await getDocs(enrollmentsQuery);
    const completionDates = new Set<string>();

    enrollmentsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.completedAt) {
        // Handle both Firestore Timestamp and regular Date/string
        let completedDate: Date;
        if (data.completedAt.toDate) {
          completedDate = data.completedAt.toDate();
        } else {
          completedDate = new Date(data.completedAt);
        }
        const dateStr = completedDate.toISOString().split('T')[0];
        completionDates.add(dateStr);
      }
    });

    // 3. Calculate Current Streak based on campaign completions
    const sortedDates = Array.from(completionDates).sort().reverse();
    let currentStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const completedToday = sortedDates.includes(today);
    const completedYesterday = sortedDates.includes(yesterday);
    const lastCompletionDate = sortedDates.length > 0 ? sortedDates[0] : null;

    // Streak is active if completed today or yesterday
    if (sortedDates.length > 0 && (completedToday || completedYesterday)) {
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

    // Streak is "at risk" if they haven't completed today but have an active streak
    const streakAtRisk = !completedToday && completedYesterday && currentStreak > 0;

    // 4. Calculate Average Score from CampaignResponses
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
      totalLearningHours,
      completedToday,
      streakAtRisk,
      lastCompletionDate
    };

  } catch (error) {
    console.error('Error calculating user stats:', error);
    return {
      averageScore: 0,
      currentStreak: 0,
      totalLearningHours: 0,
      completedToday: false,
      streakAtRisk: false,
      lastCompletionDate: null
    };
  }
}

// ============================================================================
// STREAK MANAGEMENT
// ============================================================================

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 90, 100, 180, 365];

/**
 * Helper to get today's date as ISO string (YYYY-MM-DD)
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Helper to get yesterday's date as ISO string (YYYY-MM-DD)
 */
function getYesterdayDateString(): string {
  return new Date(Date.now() - 86400000).toISOString().split('T')[0];
}

/**
 * Get the user's active streak (if any)
 */
export async function getActiveStreak(userId: string): Promise<UserStreak | null> {
  try {
    const q = query(
      collection(db, USER_STREAKS_COLLECTION),
      where('userId', '==', userId),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as UserStreak;
  } catch (error) {
    console.error('Error getting active streak:', error);
    return null;
  }
}

/**
 * Get all streaks for a user (historical data)
 */
export async function getUserStreakHistory(userId: string): Promise<UserStreak[]> {
  try {
    const q = query(
      collection(db, USER_STREAKS_COLLECTION),
      where('userId', '==', userId),
      orderBy('startDate', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserStreak));
  } catch (error) {
    console.error('Error getting streak history:', error);
    return [];
  }
}

/**
 * Get user's streak summary (aggregated stats)
 */
export async function getUserStreakSummary(userId: string): Promise<UserStreakSummary> {
  try {
    const streaks = await getUserStreakHistory(userId);
    const activeStreak = streaks.find(s => s.status === 'active');
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();

    // Calculate stats
    const longestStreak = Math.max(...streaks.map(s => s.length), 0);
    const longestStreakRecord = streaks.find(s => s.length === longestStreak);
    const totalActiveDays = new Set(streaks.flatMap(s => s.activeDates)).size;
    const completedStreaks = streaks.filter(s => s.status !== 'active');
    const averageStreakLength = completedStreaks.length > 0
      ? Math.round(completedStreaks.reduce((sum, s) => sum + s.length, 0) / completedStreaks.length)
      : 0;

    // Check if completed today
    const completedToday = activeStreak?.activeDates.includes(today) || false;
    const completedYesterday = activeStreak?.activeDates.includes(yesterday) || false;
    const streakAtRisk = !completedToday && completedYesterday && (activeStreak?.length || 0) > 0;

    // Calculate achieved milestones
    const achievedMilestones = STREAK_MILESTONES.filter(m => longestStreak >= m);

    return {
      userId,
      currentStreakId: activeStreak?.id || null,
      currentStreak: activeStreak?.length || 0,
      streakAtRisk,
      completedToday,
      lastActivityDate: activeStreak?.activeDates.slice(-1)[0] || null,
      longestStreak,
      longestStreakStartDate: longestStreakRecord?.startDate || null,
      longestStreakEndDate: longestStreakRecord?.endDate || null,
      totalStreaks: streaks.length,
      totalActiveDays,
      averageStreakLength,
      streakMilestones: achievedMilestones,
    };
  } catch (error) {
    console.error('Error getting streak summary:', error);
    return {
      userId,
      currentStreakId: null,
      currentStreak: 0,
      streakAtRisk: false,
      completedToday: false,
      lastActivityDate: null,
      longestStreak: 0,
      longestStreakStartDate: null,
      longestStreakEndDate: null,
      totalStreaks: 0,
      totalActiveDays: 0,
      averageStreakLength: 0,
      streakMilestones: [],
    };
  }
}

/**
 * @deprecated Now handled by cloud function (onEnrollmentStatusChanged)
 * Log a streak event
 */
async function logStreakEvent(
  userId: string,
  streakId: string,
  eventType: StreakEvent['eventType'],
  streakLength: number,
  campaignId?: string,
  milestone?: number
): Promise<void> {
  try {
    await addDoc(collection(db, STREAK_EVENTS_COLLECTION), {
      userId,
      streakId,
      eventType,
      eventDate: getTodayDateString(),
      streakLength,
      campaignId,
      milestone,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error logging streak event:', error);
  }
}

/**
 * @deprecated This function is now handled by cloud function (onEnrollmentStatusChanged).
 * Kept for backwards compatibility but should not be called directly.
 * The cloud function automatically records streak data when enrollment status changes to 'completed'.
 */
export async function recordCampaignCompletion(
  userId: string,
  organizationId: string,
  campaignId: string
): Promise<{
  streak: UserStreak;
  isNewStreak: boolean;
  milestonesAchieved: number[];
  streakBroken: boolean;
}> {
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  // Get current active streak
  const activeStreak = await getActiveStreak(userId);

  let streak: UserStreak;
  let isNewStreak = false;
  let streakBroken = false;
  const milestonesAchieved: number[] = [];

  if (!activeStreak) {
    // No active streak - start a new one
    isNewStreak = true;
    const docRef = await addDoc(collection(db, USER_STREAKS_COLLECTION), {
      userId,
      organizationId,
      startDate: today,
      endDate: null,
      length: 1,
      status: 'active' as StreakStatus,
      activeDates: [today],
      completedCampaignIds: [campaignId],
      longestInHistory: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    streak = {
      id: docRef.id,
      userId,
      organizationId,
      startDate: today,
      endDate: null,
      length: 1,
      status: 'active',
      activeDates: [today],
      completedCampaignIds: [campaignId],
      longestInHistory: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await logStreakEvent(userId, streak.id, 'streak_started', 1, campaignId);

  } else {
    const lastActivityDate = activeStreak.activeDates.slice(-1)[0];

    if (lastActivityDate === today) {
      // Already completed something today - just add the campaign to the list
      const updatedCampaignIds = [...new Set([...activeStreak.completedCampaignIds, campaignId])];

      await updateDoc(doc(db, USER_STREAKS_COLLECTION, activeStreak.id), {
        completedCampaignIds: updatedCampaignIds,
        updatedAt: Timestamp.now(),
      });

      streak = {
        ...activeStreak,
        completedCampaignIds: updatedCampaignIds,
        updatedAt: new Date(),
      };

    } else if (lastActivityDate === yesterday) {
      // Continuing streak from yesterday
      const newLength = activeStreak.length + 1;
      const updatedActiveDates = [...activeStreak.activeDates, today];
      const updatedCampaignIds = [...new Set([...activeStreak.completedCampaignIds, campaignId])];

      await updateDoc(doc(db, USER_STREAKS_COLLECTION, activeStreak.id), {
        length: newLength,
        activeDates: updatedActiveDates,
        completedCampaignIds: updatedCampaignIds,
        updatedAt: Timestamp.now(),
      });

      streak = {
        ...activeStreak,
        length: newLength,
        activeDates: updatedActiveDates,
        completedCampaignIds: updatedCampaignIds,
        updatedAt: new Date(),
      };

      await logStreakEvent(userId, streak.id, 'streak_continued', newLength, campaignId);

      // Check for milestone achievements
      for (const milestone of STREAK_MILESTONES) {
        if (newLength >= milestone && activeStreak.length < milestone) {
          milestonesAchieved.push(milestone);
          await logStreakEvent(userId, streak.id, 'milestone_reached', newLength, campaignId, milestone);
        }
      }

    } else {
      // Gap in activity - streak was broken, end old streak and start new one
      streakBroken = true;

      // Check if old streak was the longest
      const allStreaks = await getUserStreakHistory(userId);
      const maxOtherLength = Math.max(...allStreaks.filter(s => s.id !== activeStreak.id).map(s => s.length), 0);
      const wasLongest = activeStreak.length > maxOtherLength;

      // End the old streak
      await updateDoc(doc(db, USER_STREAKS_COLLECTION, activeStreak.id), {
        status: 'broken' as StreakStatus,
        endDate: lastActivityDate,
        longestInHistory: wasLongest,
        updatedAt: Timestamp.now(),
      });

      await logStreakEvent(userId, activeStreak.id, 'streak_broken', activeStreak.length);

      // Start a new streak
      isNewStreak = true;
      const docRef = await addDoc(collection(db, USER_STREAKS_COLLECTION), {
        userId,
        organizationId,
        startDate: today,
        endDate: null,
        length: 1,
        status: 'active' as StreakStatus,
        activeDates: [today],
        completedCampaignIds: [campaignId],
        longestInHistory: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      streak = {
        id: docRef.id,
        userId,
        organizationId,
        startDate: today,
        endDate: null,
        length: 1,
        status: 'active',
        activeDates: [today],
        completedCampaignIds: [campaignId],
        longestInHistory: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await logStreakEvent(userId, streak.id, 'streak_started', 1, campaignId);
    }
  }

  return {
    streak,
    isNewStreak,
    milestonesAchieved,
    streakBroken,
  };
}

/**
 * Get streak events for a user (for activity log/timeline)
 */
export async function getStreakEvents(
  userId: string,
  limit = 50
): Promise<StreakEvent[]> {
  try {
    const q = query(
      collection(db, STREAK_EVENTS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.slice(0, limit).map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as StreakEvent));
  } catch (error) {
    console.error('Error getting streak events:', error);
    return [];
  }
}

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

export type TicketPriority = 'low' | 'medium' | 'high';
export type TicketCategory = 'bug' | 'feature' | 'question' | 'other';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  organizationId?: string;
  organizationName?: string;
  subject: string;
  message: string;
  priority: TicketPriority;
  category: TicketCategory;
  status: TicketStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  assignedTo?: string;
  notes?: string;
}

/**
 * Create a support ticket
 */
export async function createSupportTicket(data: {
  userId: string;
  userEmail: string;
  userName?: string;
  organizationId?: string;
  organizationName?: string;
  subject: string;
  message: string;
  priority: TicketPriority;
  category: TicketCategory;
}): Promise<string> {
  const ticketData = {
    ...data,
    status: 'open' as TicketStatus,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, SUPPORT_TICKETS_COLLECTION), ticketData);
  logFirestoreOperation('CREATE', SUPPORT_TICKETS_COLLECTION, { id: docRef.id });

  return docRef.id;
}

// ============================================================================
// AI CHAT HISTORY
// ============================================================================

const CHAT_SESSIONS_COLLECTION = 'chatSessions';

export interface ChatMessageDoc {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Timestamp;
  suggestedQuestions?: string[];
}

export interface ChatSessionDoc {
  userId: string;
  organizationId?: string;
  title: string;
  messages: ChatMessageDoc[];
  context: {
    userRole: string;
    currentPage?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Create a new chat session
 */
export async function createChatSession(data: {
  userId: string;
  organizationId?: string;
  title: string;
  context: { userRole: string; currentPage?: string };
}): Promise<string> {
  const sessionData: ChatSessionDoc = {
    userId: data.userId,
    organizationId: data.organizationId,
    title: data.title,
    messages: [],
    context: data.context,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, CHAT_SESSIONS_COLLECTION), removeUndefined(sessionData));
  logFirestoreOperation('CREATE', CHAT_SESSIONS_COLLECTION, { id: docRef.id });

  return docRef.id;
}

/**
 * Update chat session with new messages
 */
export async function updateChatSession(
  sessionId: string,
  messages: { id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: Date }[],
  title?: string
): Promise<void> {
  const docRef = doc(db, CHAT_SESSIONS_COLLECTION, sessionId);

  const messagesDocs: ChatMessageDoc[] = messages.map(msg => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: Timestamp.fromDate(msg.timestamp),
  }));

  const updateData: Record<string, any> = {
    messages: messagesDocs,
    updatedAt: Timestamp.now(),
  };

  if (title) {
    updateData.title = title;
  }

  await updateDoc(docRef, updateData);
  logFirestoreOperation('UPDATE', CHAT_SESSIONS_COLLECTION, { id: sessionId });
}

/**
 * Get chat sessions for a user
 */
export async function getUserChatSessions(userId: string, limit = 20): Promise<{
  id: string;
  title: string;
  messageCount: number;
  lastMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}[]> {
  const q = query(
    collection(db, CHAT_SESSIONS_COLLECTION),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  logFirestoreOperation('READ', CHAT_SESSIONS_COLLECTION, { userId, count: snapshot.size });

  return snapshot.docs.slice(0, limit).map(doc => {
    const data = doc.data() as ChatSessionDoc;
    const lastMsg = data.messages[data.messages.length - 1];
    return {
      id: doc.id,
      title: data.title,
      messageCount: data.messages.length,
      lastMessage: lastMsg?.content.slice(0, 100),
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    };
  });
}

/**
 * Get a single chat session with full messages
 */
export async function getChatSession(sessionId: string): Promise<{
  id: string;
  userId: string;
  title: string;
  messages: { id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: Date }[];
  context: { userRole: string; currentPage?: string };
  createdAt: Date;
  updatedAt: Date;
} | null> {
  const docRef = doc(db, CHAT_SESSIONS_COLLECTION, sessionId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as ChatSessionDoc;
  logFirestoreOperation('READ', CHAT_SESSIONS_COLLECTION, { id: sessionId });

  return {
    id: snapshot.id,
    userId: data.userId,
    title: data.title,
    messages: data.messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: timestampToDate(msg.timestamp),
    })),
    context: data.context,
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  };
}

/**
 * Delete a chat session
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const docRef = doc(db, CHAT_SESSIONS_COLLECTION, sessionId);
  await deleteDoc(docRef);
  logFirestoreOperation('DELETE', CHAT_SESSIONS_COLLECTION, { id: sessionId });
}

// ============================================
// USER SKILL PROFILE & GAMIFICATION FUNCTIONS
// @deprecated - XP/Level system now handled by Cloud Functions
// Use the `userStats` collection (populated by onEnrollmentStatusChanged) instead.
// These functions are kept for backwards compatibility only.
// ============================================

const USER_SKILL_PROFILES_COLLECTION = 'userSkillProfiles';

// @deprecated - XP values now defined in cloud functions
const XP_VALUES = {
  watch_video: 10,
  answer_question: 10,
  complete_module: 25,
  complete_campaign: 100,
  daily_streak: 5,
  perfect_score: 50,
  first_completion: 25,
};

// Level thresholds
const LEVEL_THRESHOLDS = [
  { level: 1, minXP: 0, title: 'Beginner', tier: 'beginner' },
  { level: 5, minXP: 500, title: 'Beginner', tier: 'beginner' },
  { level: 6, minXP: 600, title: 'Learner', tier: 'learner' },
  { level: 15, minXP: 2000, title: 'Learner', tier: 'learner' },
  { level: 16, minXP: 2100, title: 'Practitioner', tier: 'practitioner' },
  { level: 30, minXP: 5000, title: 'Practitioner', tier: 'practitioner' },
  { level: 31, minXP: 5100, title: 'Expert', tier: 'expert' },
  { level: 50, minXP: 10000, title: 'Expert', tier: 'expert' },
  { level: 51, minXP: 10100, title: 'Master', tier: 'master' },
];

// Badge definitions
const BADGE_DEFINITIONS = [
  { id: 'first-module', name: 'First Steps', description: 'Complete your first module', icon: '🎯', criteria: { type: 'modules', threshold: 1 } },
  { id: 'five-modules', name: 'Getting Started', description: 'Complete 5 modules', icon: '📚', criteria: { type: 'modules', threshold: 5 } },
  { id: 'ten-modules', name: 'Dedicated Learner', description: 'Complete 10 modules', icon: '🏆', criteria: { type: 'modules', threshold: 10 } },
  { id: 'streak-3', name: 'Consistency', description: 'Maintain a 3-day streak', icon: '🔥', criteria: { type: 'streak', threshold: 3 } },
  { id: 'streak-7', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '💪', criteria: { type: 'streak', threshold: 7 } },
  { id: 'streak-30', name: 'Monthly Master', description: 'Maintain a 30-day streak', icon: '⭐', criteria: { type: 'streak', threshold: 30 } },
  { id: 'first-campaign', name: 'Campaign Champion', description: 'Complete your first campaign', icon: '🏅', criteria: { type: 'first_completion', threshold: 1 } },
  { id: 'perfect-score', name: 'Perfectionist', description: 'Get a perfect score on a module', icon: '💯', criteria: { type: 'perfect_score', threshold: 1 } },
  { id: 'level-10', name: 'Rising Star', description: 'Reach level 10', icon: '🌟', criteria: { type: 'level', threshold: 10 } },
  { id: 'level-25', name: 'Expert Path', description: 'Reach level 25', icon: '🚀', criteria: { type: 'level', threshold: 25 } },
  { id: 'xp-1000', name: 'XP Hunter', description: 'Earn 1000 XP', icon: '💎', criteria: { type: 'xp', threshold: 1000 } },
];

/**
 * @deprecated Use server-computed level from `userStats` collection instead.
 * Calculate level from total XP
 */
export function calculateLevelFromXP(totalXP: number): { level: number; title: string; tier: string; xpForNextLevel: number; currentLevelXP: number } {
  const xpPerLevel = 100;
  const level = Math.floor(totalXP / xpPerLevel) + 1;
  const currentLevelXP = totalXP % xpPerLevel;
  const xpForNextLevel = xpPerLevel;

  // Determine tier and title
  let title = 'Beginner';
  let tier = 'beginner';

  if (level >= 51) { title = 'Master'; tier = 'master'; }
  else if (level >= 31) { title = 'Expert'; tier = 'expert'; }
  else if (level >= 16) { title = 'Practitioner'; tier = 'practitioner'; }
  else if (level >= 6) { title = 'Learner'; tier = 'learner'; }

  return { level, title, tier, xpForNextLevel, currentLevelXP };
}

/**
 * Get or create a user's skill profile
 */
export async function getUserSkillProfile(userId: string, organizationId: string): Promise<any> {
  logFirestoreOperation('READ', USER_SKILL_PROFILES_COLLECTION, { userId });

  const docRef = doc(db, USER_SKILL_PROFILES_COLLECTION, userId);
  const snapshot = await getDoc(docRef);

  if (snapshot.exists()) {
    const data = snapshot.data();
    return {
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    };
  }

  // Create default profile if doesn't exist
  const defaultProfile = {
    userId,
    organizationId,
    overallLevel: 1,
    totalXP: 0,
    competencies: {},
    streak: {
      currentStreak: 0,
      longestStreak: 0,
      lastCompletionDate: '',
      streakFreezeAvailable: true,
      weeklyGoal: 3,
      weeklyProgress: 0,
    },
    badges: [],
    badgeDetails: [],
    stats: {
      modulesCompleted: 0,
      campaignsCompleted: 0,
      questionsAnswered: 0,
      totalWatchTime: 0,
      averageScore: 0,
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(docRef, defaultProfile);
  console.log('✅ Created default skill profile for user:', userId);

  return {
    ...defaultProfile,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Update user's streak based on activity
 */
export async function updateStreak(userId: string): Promise<{ streakBroken: boolean; newStreak: number; longestStreak: number }> {
  const profile = await getUserSkillProfile(userId, '');
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const lastDate = profile.streak.lastCompletionDate;

  let newStreak = profile.streak.currentStreak;
  let longestStreak = profile.streak.longestStreak;
  let streakBroken = false;

  if (!lastDate) {
    // First activity ever
    newStreak = 1;
  } else {
    const lastDateObj = new Date(lastDate);
    const todayObj = new Date(today);
    const diffTime = todayObj.getTime() - lastDateObj.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day, streak unchanged
    } else if (diffDays === 1) {
      // Consecutive day, increment streak
      newStreak += 1;
    } else {
      // Streak broken
      streakBroken = true;
      newStreak = 1;
    }
  }

  // Update longest streak if needed
  if (newStreak > longestStreak) {
    longestStreak = newStreak;
  }

  // Update in Firestore
  const docRef = doc(db, USER_SKILL_PROFILES_COLLECTION, userId);
  await updateDoc(docRef, {
    'streak.currentStreak': newStreak,
    'streak.longestStreak': longestStreak,
    'streak.lastCompletionDate': today,
    updatedAt: Timestamp.now(),
  });

  console.log('✅ Streak updated:', { userId, newStreak, longestStreak, streakBroken });

  return { streakBroken, newStreak, longestStreak };
}

/**
 * Check and award new badges based on current stats
 */
function checkNewBadges(profile: any, newStats: any): any[] {
  const currentBadges = new Set(profile.badges || []);
  const newBadges: any[] = [];

  for (const badge of BADGE_DEFINITIONS) {
    if (currentBadges.has(badge.id)) continue;

    let earned = false;
    const criteria = badge.criteria as { type: string; threshold: number };

    switch (criteria.type) {
      case 'modules':
        earned = newStats.modulesCompleted >= criteria.threshold;
        break;
      case 'streak':
        earned = (profile.streak?.currentStreak || 0) >= criteria.threshold;
        break;
      case 'level':
        earned = newStats.level >= criteria.threshold;
        break;
      case 'xp':
        earned = newStats.totalXP >= criteria.threshold;
        break;
      case 'perfect_score':
        earned = newStats.hadPerfectScore;
        break;
      case 'first_completion':
        earned = newStats.campaignsCompleted >= criteria.threshold;
        break;
    }

    if (earned) {
      newBadges.push({
        ...badge,
        earnedAt: new Date(),
      });
    }
  }

  return newBadges;
}


/**
 * Get campaign completion summary for the completed campaign experience
 */
export async function getCampaignCompletionSummary(
  userId: string,
  campaignId: string,
  organizationId: string
): Promise<any> {
  // Get the campaign
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  // Get user's enrollment
  const enrollments = await getCampaignEnrollments(campaignId, organizationId);
  const userEnrollment = enrollments.find(e => e.userId === userId);

  if (!userEnrollment || userEnrollment.status !== 'completed') {
    return null;
  }

  // Get user's responses for this campaign
  const responses = await getCampaignResponses(campaignId, organizationId);
  const userResponses = responses.filter(r => r.userId === userId);

  // Calculate average score
  const scaleResponses = userResponses.filter(r => typeof r.answer === 'number');
  const averageScore = scaleResponses.length > 0
    ? Math.round(scaleResponses.reduce((sum, r) => sum + (r.answer as number), 0) / scaleResponses.length * 20) // Convert 1-5 scale to 0-100
    : 0;

  // Get user's skill profile for badges earned
  const profile = await getUserSkillProfile(userId, organizationId);

  // Calculate time spent (estimate based on video durations)
  const totalModules = campaign.items.length;
  const estimatedTimePerModule = 5 * 60; // 5 minutes in seconds
  const timeSpent = totalModules * estimatedTimePerModule;

  return {
    campaignId,
    campaignTitle: campaign.title,
    completedAt: userEnrollment.completedAt || new Date(),
    timeSpent,
    modulesCompleted: userEnrollment.completedModules || totalModules,
    totalModules,
    questionsAnswered: userResponses.length,
    averageScore,
    xpEarned: XP_VALUES.complete_campaign + (totalModules * XP_VALUES.complete_module),
    badgesEarned: profile.badgeDetails?.filter((b: any) => {
      const earnedDate = new Date(b.earnedAt);
      const completedDate = new Date(userEnrollment.completedAt || Date.now());
      // Badges earned within 1 day of completion
      return Math.abs(earnedDate.getTime() - completedDate.getTime()) < 24 * 60 * 60 * 1000;
    }) || [],
    competenciesImproved: [], // Would need historical data to track this
    peerComparison: {
      percentile: 75, // Mock - would need real calculation
      averageOrgScore: averageScore - 5, // Mock
    },
  };
}

/**
 * Recalculate badges for a user
 * This calls the Cloud Function to re-evaluate all badge criteria
 * and award any missing badges retroactively
 */
export async function recalculateBadges(userId?: string): Promise<{
  success: boolean;
  newBadges: Array<{ id: string; name: string; icon: string }>;
  totalBadges: number;
}> {
  const recalculateBadgesFn = httpsCallable<
    { userId?: string },
    { success: boolean; newBadges: Array<{ id: string; name: string; icon: string }>; totalBadges: number }
  >(functions, 'recalculateBadges');

  const result = await recalculateBadgesFn({ userId });
  return result.data;
}

/**
 * Get skill assessment history for a user
 * This queries the skillAssessments collection for all historical assessments
 * Useful for displaying progress charts over time
 */
export async function getSkillAssessmentHistory(
  userId: string,
  organizationId: string,
  options?: {
    skillId?: string;
    competencyId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<SkillAssessment[]> {
  let q = query(
    collection(db, 'skillAssessments'),
    where('userId', '==', userId),
    where('organizationId', '==', organizationId),
    orderBy('assessedAt', 'desc')
  );

  if (options?.skillId) {
    q = query(q, where('skillId', '==', options.skillId));
  }

  if (options?.competencyId) {
    q = query(q, where('competencyId', '==', options.competencyId));
  }

  if (options?.limit) {
    q = query(q, firestoreLimit(options.limit));
  }

  const snapshot = await getDocs(q);
  const assessments = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    assessedAt: doc.data().assessedAt?.toDate?.() || doc.data().assessedAt,
  })) as SkillAssessment[];

  // Filter by date range in memory if provided (Firestore doesn't support multiple inequality filters)
  if (options?.startDate || options?.endDate) {
    return assessments.filter(a => {
      const date = new Date(a.assessedAt);
      if (options.startDate && date < options.startDate) return false;
      if (options.endDate && date > options.endDate) return false;
      return true;
    });
  }

  return assessments;
}

/**
 * Get skill assessments for a specific campaign
 * Returns computed skill scores from the cloud function
 */
export async function getCampaignSkillAssessments(
  campaignId: string,
  organizationId: string
): Promise<SkillAssessment[]> {
  const q = query(
    collection(db, 'skillAssessments'),
    where('campaignId', '==', campaignId),
    where('organizationId', '==', organizationId),
    orderBy('assessedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    assessedAt: doc.data().assessedAt?.toDate?.() || doc.data().assessedAt,
  })) as SkillAssessment[];
}

/**
 * Get aggregated skill scores over time for charts
 * Groups assessments by date and skill/competency, calculating average scores
 */
export async function getSkillProgressOverTime(
  userId: string,
  organizationId: string,
  options?: {
    competencyId?: string;
    days?: number; // Default 90 days
  }
): Promise<{
  dates: string[];
  competencies: {
    [competencyId: string]: {
      name: string;
      scores: (number | null)[]; // null for dates with no data
    };
  };
  skills: {
    [skillId: string]: {
      name: string;
      competencyId: string;
      scores: (number | null)[];
    };
  };
}> {
  const days = options?.days || 90;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const assessments = await getSkillAssessmentHistory(userId, organizationId, {
    competencyId: options?.competencyId,
    startDate,
  });

  // Generate date range
  const dates: string[] = [];
  const current = new Date(startDate);
  const today = new Date();
  while (current <= today) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  // Group assessments by date
  const byDateAndSkill: { [date: string]: { [skillId: string]: number[] } } = {};
  const byDateAndCompetency: { [date: string]: { [competencyId: string]: number[] } } = {};
  const skillNames: { [skillId: string]: { name: string; competencyId: string } } = {};
  const competencyNames: { [competencyId: string]: string } = {};

  // Get skill and competency names from the competencies definition
  const { COMPETENCIES } = await import('./competencies');
  for (const comp of COMPETENCIES) {
    competencyNames[comp.id] = comp.name;
    for (const skill of comp.skills) {
      skillNames[skill.id] = { name: skill.name, competencyId: comp.id };
    }
  }

  for (const assessment of assessments) {
    const date = new Date(assessment.assessedAt).toISOString().split('T')[0];

    // Group by skill
    if (!byDateAndSkill[date]) byDateAndSkill[date] = {};
    if (!byDateAndSkill[date][assessment.skillId]) byDateAndSkill[date][assessment.skillId] = [];
    byDateAndSkill[date][assessment.skillId].push(assessment.calculatedScore);

    // Group by competency
    if (!byDateAndCompetency[date]) byDateAndCompetency[date] = {};
    if (!byDateAndCompetency[date][assessment.competencyId]) byDateAndCompetency[date][assessment.competencyId] = [];
    byDateAndCompetency[date][assessment.competencyId].push(assessment.calculatedScore);
  }

  // Build result with daily averages and carry-forward for missing dates
  const competencies: { [id: string]: { name: string; scores: (number | null)[] } } = {};
  const skills: { [id: string]: { name: string; competencyId: string; scores: (number | null)[] } } = {};

  // Track last known values for carry-forward
  const lastSkillScore: { [skillId: string]: number } = {};
  const lastCompetencyScore: { [compId: string]: number } = {};

  for (const date of dates) {
    // Calculate skill scores for this date
    for (const skillId of Object.keys(skillNames)) {
      if (!skills[skillId]) {
        skills[skillId] = {
          name: skillNames[skillId].name,
          competencyId: skillNames[skillId].competencyId,
          scores: []
        };
      }

      if (byDateAndSkill[date]?.[skillId]) {
        // Has data for this date - calculate average of day's assessments
        const dayScores = byDateAndSkill[date][skillId];
        const avg = Math.round(dayScores.reduce((a, b) => a + b, 0) / dayScores.length);
        skills[skillId].scores.push(avg);
        lastSkillScore[skillId] = avg;
      } else if (lastSkillScore[skillId] !== undefined) {
        // No data for this date - carry forward last known value
        skills[skillId].scores.push(lastSkillScore[skillId]);
      } else {
        // No data yet for this skill
        skills[skillId].scores.push(null);
      }
    }

    // Calculate competency scores for this date
    for (const compId of Object.keys(competencyNames)) {
      if (!competencies[compId]) {
        competencies[compId] = { name: competencyNames[compId], scores: [] };
      }

      if (byDateAndCompetency[date]?.[compId]) {
        // Has data for this date - calculate average of day's assessments
        const dayScores = byDateAndCompetency[date][compId];
        const avg = Math.round(dayScores.reduce((a, b) => a + b, 0) / dayScores.length);
        competencies[compId].scores.push(avg);
        lastCompetencyScore[compId] = avg;
      } else if (lastCompetencyScore[compId] !== undefined) {
        // No data for this date - carry forward last known value
        competencies[compId].scores.push(lastCompetencyScore[compId]);
      } else {
        // No data yet for this competency
        competencies[compId].scores.push(null);
      }
    }
  }

  return { dates, competencies, skills };
}
