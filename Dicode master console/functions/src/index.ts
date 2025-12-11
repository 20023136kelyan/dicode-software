import { Buffer } from "node:buffer";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { onRequest, onCall, HttpsError, type Request as FunctionsRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { onDocumentUpdated, onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import type { Response as FunctionsResponse } from "express";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import * as functions from "firebase-functions";
import OpenAI from 'openai';

import { POST as generateVideoPost } from "@/app/api/generate-video/route";
import { POST as mergeVideosPost } from "@/app/api/merge-videos/route";
// import { POST as extractFramePost } from "@/app/api/extract-frame/route"; // Removed as it doesn't exist
import { POST as remixVideoPost } from "@/app/api/remix-video/route";
import { POST as generateImagesPost } from "@/app/api/generate-images/route";
import { POST as suggestPromptPost } from "@/app/api/suggest-prompt/route";
import { POST as questionToolsPost } from "@/app/api/question-tools/route";
import { POST as videoTitlePost } from "@/app/api/video-title/route";
import { POST as deleteDepartmentsPost } from "@/app/api/delete-departments/route";
import { GET as videoGet } from "@/app/api/videos/[id]/route";

// ... [existing imports]

// Inside ROUTES array (comment removed)
import { GET as videoContentGet } from "@/app/api/videos/[id]/content/route";
import { POST as videoSavePost } from "@/app/api/videos/[id]/save/route";
import { GET as healthGet } from "@/app/api/health/route";

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();

const bundledFfmpegPath = join(process.cwd(), "bin", "ffmpeg");
if (!process.env.FFMPEG_PATH && existsSync(bundledFfmpegPath)) {
  process.env.FFMPEG_PATH = bundledFfmpegPath;
}

// ============================================
// EMPLOYEE NOTIFICATION SYSTEM
// ============================================

const EMPLOYEE_NOTIFICATIONS_COLLECTION = "employeeNotifications";

type EmployeeNotificationType =
  | 'badge_earned'
  | 'campaign_completed'
  | 'streak_milestone'
  | 'streak_at_risk'
  | 'streak_broken'
  | 'new_campaign'
  | 'campaign_reminder'
  | 'level_up'
  | 'skill_mastered'
  | 'welcome'
  | 'system';

interface CreateEmployeeNotificationParams {
  userId: string;
  organizationId: string;
  type: EmployeeNotificationType;
  title: string;
  message: string;
  priority?: 'low' | 'normal' | 'high';
  actionUrl?: string;
  actionLabel?: string;
  resourceType?: 'campaign' | 'badge' | 'streak' | 'skill';
  resourceId?: string;
  resourceName?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

/**
 * Create an employee notification
 * Stored in the employeeNotifications collection
 */
async function createEmployeeNotification(params: CreateEmployeeNotificationParams): Promise<string> {
  const notificationData = {
    userId: params.userId,
    organizationId: params.organizationId,
    type: params.type,
    title: params.title,
    message: params.message,
    priority: params.priority || 'normal',
    read: false,
    actionUrl: params.actionUrl || null,
    actionLabel: params.actionLabel || null,
    resourceType: params.resourceType || null,
    resourceId: params.resourceId || null,
    resourceName: params.resourceName || null,
    metadata: params.metadata || {},
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: params.expiresAt ? params.expiresAt : null,
  };

  const docRef = await db.collection(EMPLOYEE_NOTIFICATIONS_COLLECTION).add(notificationData);
  logger.info(`📬 Created notification for user ${params.userId}: ${params.title}`);
  return docRef.id;
}

/**
 * Create badge earned notifications for newly awarded badges
 */
async function notifyBadgesEarned(
  userId: string,
  organizationId: string,
  badges: Array<{ id: string; name: string; description: string; icon: string }>
): Promise<void> {
  const promises = badges.map((badge) =>
    createEmployeeNotification({
      userId,
      organizationId,
      type: 'badge_earned',
      title: `🏆 Badge Earned: ${badge.name}`,
      message: badge.description,
      priority: 'normal',
      resourceType: 'badge',
      resourceId: badge.id,
      resourceName: badge.name,
      metadata: {
        badgeId: badge.id,
        badgeName: badge.name,
        badgeIcon: badge.icon,
      },
    })
  );
  await Promise.all(promises);
}

/**
 * Create campaign completed notification
 */
async function notifyCampaignCompleted(
  userId: string,
  organizationId: string,
  campaignId: string,
  campaignTitle: string,
  xpEarned?: number
): Promise<void> {
  await createEmployeeNotification({
    userId,
    organizationId,
    type: 'campaign_completed',
    title: '🎉 Campaign Completed!',
    message: `Great job finishing "${campaignTitle}"${xpEarned ? ` and earning ${xpEarned} XP` : ''}!`,
    priority: 'normal',
    actionUrl: '/employee/learn',
    resourceType: 'campaign',
    resourceId: campaignId,
    resourceName: campaignTitle,
    metadata: {
      campaignId,
      campaignTitle,
      xpEarned,
    },
  });
}

/**
 * Create streak milestone notification
 */
async function notifyStreakMilestone(
  userId: string,
  organizationId: string,
  streakLength: number
): Promise<void> {
  await createEmployeeNotification({
    userId,
    organizationId,
    type: 'streak_milestone',
    title: `🔥 ${streakLength}-Day Streak!`,
    message: `Amazing! You've been learning for ${streakLength} days in a row. Keep it up!`,
    priority: 'normal',
    resourceType: 'streak',
    metadata: {
      streakLength,
    },
  });
}

/**
 * Create level up notification
 */
async function notifyLevelUp(
  userId: string,
  organizationId: string,
  newLevel: number,
  levelTitle: string
): Promise<void> {
  await createEmployeeNotification({
    userId,
    organizationId,
    type: 'level_up',
    title: `⬆️ Level Up! You're now Level ${newLevel}`,
    message: `Congratulations on reaching ${levelTitle}! Keep learning to unlock more achievements.`,
    priority: 'normal',
    metadata: {
      newLevel,
      levelTitle,
    },
  });
}

/**
 * Create skill mastered notification
 */
async function notifySkillMastered(
  userId: string,
  organizationId: string,
  skillId: string,
  skillName: string,
  skillLevel: number
): Promise<void> {
  await createEmployeeNotification({
    userId,
    organizationId,
    type: 'skill_mastered',
    title: `🌟 Skill Level Up: ${skillName}`,
    message: `You've reached Level ${skillLevel} in ${skillName}!`,
    priority: 'normal',
    resourceType: 'skill',
    resourceId: skillId,
    resourceName: skillName,
    metadata: {
      skillId,
      skillName,
      skillLevel,
    },
  });
}

/**
 * Create new campaign available notification
 */
async function notifyNewCampaign(
  userId: string,
  organizationId: string,
  campaignId: string,
  campaignTitle: string,
  campaignDescription?: string
): Promise<void> {
  await createEmployeeNotification({
    userId,
    organizationId,
    type: 'new_campaign',
    title: '📚 New Campaign Available',
    message: `"${campaignTitle}" is now available for you to start learning!`,
    priority: 'normal',
    actionUrl: `/employee/campaign/${campaignId}`,
    actionLabel: 'Start Learning',
    resourceType: 'campaign',
    resourceId: campaignId,
    resourceName: campaignTitle,
    metadata: {
      campaignId,
      campaignTitle,
      campaignDescription: campaignDescription?.substring(0, 100),
    },
  });
}

type NextRouteHandler = (...args: any[]) => Promise<Response>;

interface RouteDefinition {
  method: string;
  matcher: RegExp;
  handler: NextRouteHandler;
  buildParams?: (match: RegExpMatchArray) => Record<string, string>;
}

const ROUTES: RouteDefinition[] = [
  { method: "POST", matcher: /^\/api\/generate-video\/?$/, handler: generateVideoPost },
  { method: "POST", matcher: /^\/api\/merge-videos\/?$/, handler: mergeVideosPost },
  // { method: "POST", matcher: /^\/api\/extract-frame\/?$/, handler: extractFramePost },
  { method: "POST", matcher: /^\/api\/remix-video\/?$/, handler: remixVideoPost },
  { method: "POST", matcher: /^\/api\/generate-images\/?$/, handler: generateImagesPost },
  { method: "POST", matcher: /^\/api\/suggest-prompt\/?$/, handler: suggestPromptPost },
  { method: "POST", matcher: /^\/api\/question-tools\/?$/, handler: questionToolsPost },
  { method: "POST", matcher: /^\/api\/video-title\/?$/, handler: videoTitlePost },
  { method: "POST", matcher: /^\/api\/delete-departments\/?$/, handler: deleteDepartmentsPost },
  {
    method: "GET",
    matcher: /^\/api\/videos\/([^/]+)\/?$/,
    handler: videoGet,
    buildParams: (match) => ({ id: decodeURIComponent(match[1]) }),
  },
  {
    method: "GET",
    matcher: /^\/api\/videos\/([^/]+)\/content\/?$/,
    handler: videoContentGet,
    buildParams: (match) => ({ id: decodeURIComponent(match[1]) }),
  },
  {
    method: "POST",
    matcher: /^\/api\/videos\/([^/]+)\/save\/?$/,
    handler: videoSavePost,
    buildParams: (match) => ({ id: decodeURIComponent(match[1]) }),
  },
  { method: "GET", matcher: /^\/api\/health\/?$/, handler: healthGet },
];

const findRoute = (method: string, path: string) => {
  const normalizedMethod = method.toUpperCase();
  for (const route of ROUTES) {
    if (route.method !== normalizedMethod) continue;
    const match = path.match(route.matcher);
    if (match) {
      const params = route.buildParams ? route.buildParams(match) : undefined;
      return {
        handler: route.handler,
        context: params ? { params: Promise.resolve(params) } : undefined,
      };
    }
  }
  return null;
};

const headerEntries = (req: FunctionsRequest) => {
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(key, entry));
    } else {
      headers.set(key, value as string);
    }
  });
  return headers;
};

type NodeRequestInit = RequestInit & { duplex?: "half" };

const buildWebRequest = (req: FunctionsRequest) => {
  const protocol =
    (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() || "https";
  const host =
    (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim()
    || (req.headers.host as string)
    || "localhost";
  const originalUrl = req.originalUrl || req.url || req.path || "/";
  const fullUrl = `${protocol}://${host}${originalUrl}`;

  const headers = headerEntries(req);
  const method = req.method || "GET";
  const hasBody = !["GET", "HEAD"].includes(method.toUpperCase());
  const body = hasBody && req.rawBody ? Buffer.from(req.rawBody) : undefined;

  const init: NodeRequestInit = {
    method,
    headers,
  };

  if (body) {
    init.body = body;
    init.duplex = "half";
  }

  return new Request(fullUrl, init);
};

const sendWebResponse = async (res: FunctionsResponse, response: globalThis.Response, origin?: string) => {
  // Ensure CORS headers are always present
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") return;
    res.setHeader(key, value);
  });

  res.status(response.status);
  if (response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } else {
    res.send();
  }
};

const getPathname = (req: FunctionsRequest) => {
  if (req.path) return req.path;
  try {
    const url = new URL(req.url ?? "/", "https://placeholder.local");
    return url.pathname;
  } catch {
    return "/";
  }
};

export const api = onRequest(
  {
    region: process.env.FUNCTION_REGION ?? "us-central1",
    timeoutSeconds: 540,
    memory: "8GiB",
    concurrency: 1,
    maxInstances: 1,
    invoker: "public",
  },
  async (req, res) => {
    const path = getPathname(req);
    const origin = req.headers.origin || "*";

    // Set CORS headers for all requests
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "*");
      res.status(204).send();
      return;
    }

    const match = await findRoute(req.method ?? "GET", path);
    if (!match) {
      logger.warn("Unhandled API route", { method: req.method, path });
      res.status(404).json({ error: { message: "Not Found" } });
      return;
    }

    try {
      const webRequest = buildWebRequest(req);
      const response = await match.handler(webRequest, match.context as any);
      await sendWebResponse(res, response, origin);
    } catch (error) {
      logger.error("API handler failed", error as Record<string, unknown>);
      // Ensure CORS headers are present in error response
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.status(500).json({ error: { message: "Internal error" } });
    }
  },
);

// ============================================
// CAMPAIGN AUTOMATION CLOUD FUNCTIONS
// ============================================

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";
const FROM_EMAIL = "erick.xu@di-code.de";
const FROM_NAME = "DiCode";

// Email sending utilities
interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: EmailParams): Promise<void> {
  if (!SENDGRID_API_KEY) {
    logger.warn("⚠️ SendGrid API key not configured. Email not sent", { to, subject });
    return;
  }

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
    }

    logger.info("✅ Email sent successfully", { to, subject });
  } catch (error) {
    logger.error("❌ Failed to send email", error);
    throw error;
  }
}

// Brand colors matching client app
const BRAND_PRIMARY = '#C9A227'; // Gold/amber accent
const BRAND_DARK = '#1a1a1b';
const BRAND_TEXT = '#2d2d2d';
const BRAND_MUTED = '#6b7280';
const LOGO_URL = 'https://storage.googleapis.com/dicode-software.firebasestorage.app/public/dicode_logo.png';

function generateEmailTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>DiCode</title>
      <style>
        body { 
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
          line-height: 1.6; 
          color: ${BRAND_TEXT}; 
          margin: 0; 
          padding: 0; 
          background-color: #f8f9fa; 
          -webkit-font-smoothing: antialiased;
        }
        .email-wrapper {
          width: 100%;
          background-color: #f8f9fa;
          padding: 40px 20px;
        }
        .email-container {
          max-width: 560px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
        }
        .email-header {
          padding: 32px 40px;
          border-bottom: 1px solid #f0f0f0;
        }
        .logo-text {
          font-size: 22px;
          font-weight: 700;
          color: ${BRAND_DARK};
          letter-spacing: -0.5px;
        }
        .email-content {
          padding: 40px;
        }
        .email-content h2 {
          margin: 0 0 24px 0;
          font-size: 24px;
          font-weight: 600;
          color: ${BRAND_TEXT};
          line-height: 1.3;
        }
        .email-content p {
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
          color: ${BRAND_MUTED};
        }
        .email-content strong {
          color: ${BRAND_TEXT};
          font-weight: 600;
        }
        .button {
          display: inline-block;
          padding: 14px 28px;
          background-color: ${BRAND_PRIMARY};
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
        }
        .email-footer {
          padding: 24px 40px 32px;
          background-color: #fafafa;
          border-top: 1px solid #f0f0f0;
          text-align: center;
        }
        .email-footer p {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: ${BRAND_MUTED};
        }
        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 16px; }
          .email-header, .email-content, .email-footer { padding-left: 24px; padding-right: 24px; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-container">
          <div class="email-header">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  <img src="${LOGO_URL}" alt="DiCode" width="40" height="40" style="display: block; border-radius: 8px;" />
                </td>
                <td style="vertical-align: middle;">
                  <span class="logo-text">DiCode</span>
                </td>
              </tr>
            </table>
          </div>
          <div class="email-content">
            ${content}
          </div>
          <div class="email-footer">
            <p>This is an automated message from DiCode.</p>
            <p>If you have questions, please contact your organization administrator.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Helper function to check if user matches campaign filters
function checkUserMatchesCampaignFilters(campaign: any, user: any): boolean {

  const { allowedDepartments, allowedEmployeeIds, allowedCohortIds, allowedRoles } = campaign;

  // If no granular filters, all users in organization match
  const hasGranularFilters =
    (allowedDepartments && allowedDepartments.length > 0) ||
    (allowedEmployeeIds && allowedEmployeeIds.length > 0) ||
    (allowedCohortIds && allowedCohortIds.length > 0) ||
    (allowedRoles && allowedRoles.length > 0);

  if (!hasGranularFilters) {
    return true;
  }

  // Check role filter
  if (allowedRoles && allowedRoles.length > 0) {
    if (user.role && allowedRoles.includes(user.role)) {
      return true;
    }
  }

  // Check department filter
  if (allowedDepartments && allowedDepartments.length > 0) {
    if (user.department && allowedDepartments.includes(user.department)) {
      return true;
    }
  }

  // Check employee ID filter
  if (allowedEmployeeIds && allowedEmployeeIds.length > 0) {
    if (allowedEmployeeIds.includes(user.id)) {
      return true;
    }
  }

  // Check cohort filter
  if (allowedCohortIds && allowedCohortIds.length > 0 && user.cohortIds) {
    const hasMatchingCohort = user.cohortIds.some((cohortId: string) =>
      allowedCohortIds.includes(cohortId)
    );
    if (hasMatchingCohort) {
      return true;
    }
  }

  return false;
}

// Helper: Get count of notifications sent to a user for a campaign
async function getNotificationCount(
  campaignId: string,
  userId: string,
  type: string
): Promise<number> {
  const snapshot = await db
    .collection("campaignNotifications")
    .where("campaignId", "==", campaignId)
    .where("userId", "==", userId)
    .where("type", "==", type)
    .where("status", "==", "sent")
    .get();

  return snapshot.size;
}

// Helper: Get last notification sent to a user for a campaign
async function getLastNotification(
  campaignId: string,
  userId: string,
  type: string
): Promise<any> {
  const snapshot = await db
    .collection("campaignNotifications")
    .where("campaignId", "==", campaignId)
    .where("userId", "==", userId)
    .where("type", "==", type)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0].data();
}

/**
 * Cloud Function: Auto-Enroll on Campaign Publish
 * Triggered when a campaign's isPublished status changes to true
 */
export const onCampaignPublished = onDocumentUpdated(
  {
    document: "campaigns/{campaignId}",
    region: process.env.FUNCTION_REGION ?? "us-central1",
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const campaignId = event.params.campaignId;

    // Check if campaign was just published
    if (!before?.metadata?.isPublished && after?.metadata?.isPublished) {
      logger.info(`📢 Campaign published: ${campaignId}`);

      try {
        const campaign = after;
        const organizationId = campaign.allowedOrganizations?.[0];

        if (!organizationId) {
          logger.info("⚠️ No organization specified for campaign");
          return;
        }

        // Get all users in the organization
        const usersSnapshot = await db
          .collection("users")
          .where("organization", "==", organizationId)
          .get();

        const enrollmentPromises: Promise<any>[] = [];
        const notificationPromises: Promise<any>[] = [];

        for (const userDoc of usersSnapshot.docs) {
          const userId = userDoc.id;
          const userData = userDoc.data();

          // Check if user matches campaign filters
          const matchesFilters = checkUserMatchesCampaignFilters(campaign, userData);

          if (matchesFilters) {
            // Check if already enrolled
            const existingEnrollment = await db
              .collection("campaignEnrollments")
              .where("campaignId", "==", campaignId)
              .where("userId", "==", userId)
              .get();

            if (existingEnrollment.empty) {
              // Create enrollment
              enrollmentPromises.push(
                db.collection("campaignEnrollments").add({
                  campaignId,
                  userId,
                  organizationId,
                  status: "not-started",
                  enrolledAt: FieldValue.serverTimestamp(),
                  accessCount: 0,
                  metadata: {
                    enrolledBy: campaign.metadata?.createdBy,
                    autoEnrolled: true,
                  },
                })
              );

              // Send in-app notification for new campaign
              notificationPromises.push(
                notifyNewCampaign(
                  userId,
                  organizationId,
                  campaignId,
                  campaign.title,
                  campaign.description
                )
              );

              // Queue invitation email if enabled
              if (campaign.automation?.autoSendInvites) {
                notificationPromises.push(
                  db.collection("campaignNotifications").add({
                    campaignId,
                    userId,
                    organizationId,
                    type: "invitation",
                    status: "pending",
                    recipientEmail: userData.email,
                    scheduledFor: FieldValue.serverTimestamp(),
                    retryCount: 0,
                    metadata: {
                      campaignTitle: campaign.title,
                      userName: userData.name || userData.email,
                    },
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                  })
                );
              }
            }
          }
        }

        await Promise.all([...enrollmentPromises, ...notificationPromises]);
        logger.info(`✅ Auto-enrolled ${enrollmentPromises.length} users in campaign ${campaignId}`);

        // Compute campaign metrics from items and videos
        const itemIds = campaign.itemIds || [];
        let totalItems = 0;
        let totalQuestions = 0;
        let durationSeconds = 0;

        if (itemIds.length > 0) {
          // Fetch all campaign items in batches (Firestore 'in' limit is 10)
          const allItems: FirebaseFirestore.DocumentData[] = [];
          for (let i = 0; i < itemIds.length; i += 10) {
            const batch = itemIds.slice(i, i + 10);
            const batchSnapshot = await db
              .collection("campaignItems")
              .where("__name__", "in", batch)
              .get();
            batchSnapshot.docs.forEach((doc) => allItems.push({ id: doc.id, ...doc.data() }));
          }

          totalItems = allItems.length;

          // Get unique video IDs
          const videoIds = [...new Set(allItems.map((item) => item.videoId))];

          // Fetch videos in batches
          for (let i = 0; i < videoIds.length; i += 10) {
            const batch = videoIds.slice(i, i + 10);
            const videosSnapshot = await db
              .collection("videos")
              .where("__name__", "in", batch)
              .get();

            videosSnapshot.docs.forEach((doc) => {
              const video = doc.data();
              durationSeconds += video.duration || 0;
              totalQuestions += video.questions?.length || 0;
            });
          }
        }

        const estimatedMinutes = Math.ceil(durationSeconds / 60) + totalQuestions;
        const totalXP = (totalItems * 25) + (totalQuestions * 5);

        // Update campaign stats and computed metrics
        await event.data?.after.ref.update({
          "stats.totalEnrollments": enrollmentPromises.length,
          "stats.notStartedCount": enrollmentPromises.length,
          "stats.inProgressCount": 0,
          "stats.completedCount": 0,
          "metadata.computed": {
            totalItems,
            totalQuestions,
            durationSeconds,
            estimatedMinutes,
            totalXP,
          },
        });

        logger.info(`✅ Campaign ${campaignId} metrics computed: ${totalItems} items, ${totalQuestions} questions, ${estimatedMinutes} min`);
      } catch (error) {
        logger.error("❌ Error auto-enrolling users", error);
      }
    }
  }
);

/**
 * Cloud Function: Recompute Campaign Metrics on Video Update
 * Triggered when a video's duration or questions are updated
 */
export const onVideoUpdated = onDocumentUpdated(
  {
    document: "videos/{videoId}",
    region: process.env.FUNCTION_REGION ?? "us-central1",
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const videoId = event.params.videoId;

    // Check if duration or questions changed
    const durationChanged = before?.duration !== after?.duration;
    const questionsChanged =
      (before?.questions?.length || 0) !== (after?.questions?.length || 0);

    if (!durationChanged && !questionsChanged) {
      return; // No relevant changes
    }

    logger.info(`🎬 Video ${videoId} updated - recomputing affected campaign metrics`);

    try {
      // Find all campaign items that use this video
      const itemsSnapshot = await db
        .collection("campaignItems")
        .where("videoId", "==", videoId)
        .get();

      if (itemsSnapshot.empty) {
        logger.info("No campaigns use this video");
        return;
      }

      // Get unique campaign IDs
      const campaignIds = [...new Set(itemsSnapshot.docs.map((doc) => doc.data().campaignId))];

      logger.info(`Found ${campaignIds.length} campaigns using video ${videoId}`);

      // Recompute metrics for each campaign
      for (const campaignId of campaignIds) {
        const campaignRef = db.collection("campaigns").doc(campaignId);
        const campaignSnap = await campaignRef.get();

        if (!campaignSnap.exists) continue;

        const campaign = campaignSnap.data();
        const itemIds = campaign?.itemIds || [];

        if (itemIds.length === 0) continue;

        // Fetch all campaign items in batches
        const allItems: FirebaseFirestore.DocumentData[] = [];
        for (let i = 0; i < itemIds.length; i += 10) {
          const batch = itemIds.slice(i, i + 10);
          const batchSnapshot = await db
            .collection("campaignItems")
            .where("__name__", "in", batch)
            .get();
          batchSnapshot.docs.forEach((doc) => allItems.push({ id: doc.id, ...doc.data() }));
        }

        const totalItems = allItems.length;

        // Get unique video IDs from items
        const videoIds = [...new Set(allItems.map((item) => item.videoId))];

        let totalQuestions = 0;
        let durationSeconds = 0;

        // Fetch videos in batches
        for (let i = 0; i < videoIds.length; i += 10) {
          const batch = videoIds.slice(i, i + 10);
          const videosSnapshot = await db
            .collection("videos")
            .where("__name__", "in", batch)
            .get();

          videosSnapshot.docs.forEach((doc) => {
            const video = doc.data();
            durationSeconds += video.duration || 0;
            totalQuestions += video.questions?.length || 0;
          });
        }

        const estimatedMinutes = Math.ceil(durationSeconds / 60) + totalQuestions;
        const totalXP = (totalItems * 25) + (totalQuestions * 5);

        // Update campaign metrics
        await campaignRef.update({
          "metadata.computed": {
            totalItems,
            totalQuestions,
            durationSeconds,
            estimatedMinutes,
            totalXP,
          },
          "metadata.updatedAt": FieldValue.serverTimestamp(),
        });

        logger.info(`✅ Updated campaign ${campaignId} metrics`);
      }
    } catch (error) {
      logger.error("❌ Error recomputing campaign metrics on video update", error);
    }
  }
);

/**
 * Cloud Function: Send Scheduled Reminders
 * Runs daily at 9 AM EST to send reminder emails
 */
export const sendScheduledReminders = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "America/New_York",
    region: process.env.FUNCTION_REGION ?? "us-central1",
  },
  async () => {
    logger.info("⏰ Running scheduled reminder job...");

    try {
      // Get all published campaigns with reminders enabled
      const campaignsSnapshot = await db
        .collection("campaigns")
        .where("metadata.isPublished", "==", true)
        .where("automation.sendReminders", "==", true)
        .get();

      const notificationPromises: Promise<any>[] = [];

      for (const campaignDoc of campaignsSnapshot.docs) {
        const campaign = campaignDoc.data();
        const campaignId = campaignDoc.id;

        // Get enrollments that are in-progress (not completed)
        const enrollmentsSnapshot = await db
          .collection("campaignEnrollments")
          .where("campaignId", "==", campaignId)
          .where("status", "in", ["not-started", "in-progress"])
          .get();

        for (const enrollmentDoc of enrollmentsSnapshot.docs) {
          const enrollment = enrollmentDoc.data();
          const userId = enrollment.userId;

          // Check if user has exceeded max reminders
          const reminderCount = await getNotificationCount(campaignId, userId, "reminder");

          const maxReminders = campaign.automation?.maxReminders || 3;
          if (reminderCount >= maxReminders) {
            continue;
          }

          // Check if enough time has passed since last reminder
          const lastReminder = await getLastNotification(campaignId, userId, "reminder");

          const reminderFrequency = campaign.automation?.reminderFrequency || 3; // days
          const daysSinceLastReminder = lastReminder
            ? (Date.now() - lastReminder.createdAt.toMillis()) / (1000 * 60 * 60 * 24)
            : reminderFrequency + 1;

          if (daysSinceLastReminder >= reminderFrequency) {
            // Get user data
            const userDoc = await db.collection("users").doc(userId).get();
            const userData = userDoc.data();

            if (userData) {
              // Queue reminder notification
              notificationPromises.push(
                db.collection("campaignNotifications").add({
                  campaignId,
                  userId,
                  organizationId: enrollment.organizationId,
                  type: "reminder",
                  status: "pending",
                  recipientEmail: userData.email,
                  scheduledFor: FieldValue.serverTimestamp(),
                  retryCount: 0,
                  metadata: {
                    campaignTitle: campaign.title,
                    userName: userData.name || userData.email,
                  },
                  createdAt: FieldValue.serverTimestamp(),
                  updatedAt: FieldValue.serverTimestamp(),
                })
              );
            }
          }
        }
      }

      await Promise.all(notificationPromises);
      logger.info(`✅ Queued ${notificationPromises.length} reminder notifications`);
    } catch (error) {
      logger.error("❌ Error sending scheduled reminders", error);
    }
  }
);

/**
 * Cloud Function: Process Notification Queue
 * Runs every 5 minutes to process pending email notifications
 */
export const processNotificationQueue = onSchedule(
  {
    schedule: "*/5 * * * *",
    region: process.env.FUNCTION_REGION ?? "us-central1",
  },
  async () => {
    logger.info("📧 Processing notification queue...");

    try {
      // Get pending notifications scheduled for now or earlier
      const now = new Date();
      const notificationsSnapshot = await db
        .collection("campaignNotifications")
        .where("status", "==", "pending")
        .limit(100)
        .get();

      logger.info(`Found ${notificationsSnapshot.size} pending notifications`);

      for (const notificationDoc of notificationsSnapshot.docs) {
        const notification = notificationDoc.data();
        const notificationId = notificationDoc.id;

        try {
          // Get campaign data for email content
          const campaignDoc = await db.collection("campaigns").doc(notification.campaignId).get();
          const campaign = campaignDoc.data();

          if (!campaign) {
            throw new Error("Campaign not found");
          }

          // Use CLIENT_APP_URL for campaign links (DiCode client)
          const appUrl = process.env.CLIENT_APP_URL || "https://dicode-client.web.app";
          const campaignUrl = `${appUrl}/campaigns/${notification.campaignId}`;

          // Send appropriate email based on type
          if (notification.type === "invitation") {
            if (notification.metadata?.role === 'applicant') {
              await sendEmail({
                to: notification.recipientEmail,
                subject: `Invitation to Apply: ${campaign.title}`,
                html: generateEmailTemplate(`
                  <h2>You've been invited to apply!</h2>
                  <p>Hi ${notification.metadata?.userName || 'there'},</p>
                  <p>You have been invited to take an assessment for <strong>${campaign.allowedOrganizations?.[0] ? 'this organization' : 'us'}</strong>.</p>
                  <p>Please click the button below to set up your account and begin.</p>
                  <a href="${campaignUrl}" class="button">Start Assessment</a>
                `),
              });
            } else {
              await sendEmail({
                to: notification.recipientEmail,
                subject: `New Learning Campaign: ${campaign.title}`,
                html: generateEmailTemplate(`
                  <h2>You've been invited to a new learning campaign!</h2>
                  <p>Hi ${notification.metadata?.userName || "there"},</p>
                  <p>Your organization has enrolled you in: <strong>${campaign.title}</strong></p>
                  <a href="${campaignUrl}" class="button">Start Campaign</a>
                `),
              });
            }
          } else if (notification.type === "reminder") {
            await sendEmail({
              to: notification.recipientEmail,
              subject: `Reminder: ${campaign.title}`,
              html: generateEmailTemplate(`
                <h2>Reminder: Complete your learning campaign</h2>
                <p>Hi ${notification.metadata?.userName || "there"},</p>
                <p>You have an incomplete campaign: <strong>${campaign.title}</strong></p>
                <a href="${campaignUrl}" class="button">Continue Campaign</a>
              `),
            });
          } else if (notification.type === "completion") {
            await sendEmail({
              to: notification.recipientEmail,
              subject: `Campaign Completed: ${campaign.title}`,
              html: generateEmailTemplate(`
                <h2>🎉 Congratulations! Campaign Completed</h2>
                <p>Hi ${notification.metadata?.userName || "there"},</p>
                <p>You've completed: <strong>${campaign.title}</strong></p>
                <p>Keep up the great work!</p>
              `),
            });
          }

          // Mark as sent
          await notificationDoc.ref.update({
            status: "sent",
            sentAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          logger.info(`✅ Sent ${notification.type} notification to ${notification.recipientEmail}`);
        } catch (error) {
          logger.error(`❌ Failed to send notification ${notificationId}`, error);

          // Mark as failed and increment retry count
          const retryCount = (notification.retryCount || 0) + 1;
          await notificationDoc.ref.update({
            status: "failed",
            failureReason: String(error),
            retryCount,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    } catch (error) {
      logger.error("❌ Error processing notification queue", error);
    }
  }
);

/**
 * Cloud Function: Auto-Detect Completion
 * Triggered when campaign progress is updated
 */
export const onProgressUpdated = onDocumentWritten(
  {
    document: "campaignProgress/{progressId}",
    region: process.env.FUNCTION_REGION ?? "us-central1",
  },
  async (event) => {
    if (!event.data?.after.exists) {
      return;
    }

    const progress = event.data.after.data()!;
    const campaignId = progress.campaignId;
    const userId = progress.userId;

    try {
      // Get all progress for this user in this campaign
      const allProgressSnapshot = await db
        .collection("campaignProgress")
        .where("campaignId", "==", campaignId)
        .where("userId", "==", userId)
        .get();

      // Get campaign to know total videos
      const campaignDoc = await db.collection("campaigns").doc(campaignId).get();
      const campaign = campaignDoc.data();

      if (!campaign) {
        return;
      }

      const totalVideos = campaign.itemIds?.length || 0;
      const completedVideos = allProgressSnapshot.docs.filter((doc) => {
        const data = doc.data();
        return data.completed && data.allQuestionsAnswered;
      }).length;

      // Check if campaign is complete
      if (completedVideos >= totalVideos && totalVideos > 0) {
        logger.info(`🎉 User ${userId} completed campaign ${campaignId}`);

        // Check if already marked as completed
        const enrollmentSnapshot = await db
          .collection("campaignEnrollments")
          .where("campaignId", "==", campaignId)
          .where("userId", "==", userId)
          .get();

        if (!enrollmentSnapshot.empty) {
          const enrollmentDoc = enrollmentSnapshot.docs[0];
          const enrollment = enrollmentDoc.data();

          if (enrollment.status !== "completed") {
            // Mark enrollment as completed
            await enrollmentDoc.ref.update({
              status: "completed",
              completedAt: FieldValue.serverTimestamp(),
            });

            // Update campaign stats
            await campaignDoc.ref.update({
              "stats.completedCount": FieldValue.increment(1),
              "stats.inProgressCount": FieldValue.increment(-1),
            });

            // Queue completion notification if enabled
            if (campaign.automation?.sendConfirmations) {
              const userDoc = await db.collection("users").doc(userId).get();
              const userData = userDoc.data();

              if (userData) {
                await db.collection("campaignNotifications").add({
                  campaignId,
                  userId,
                  organizationId: enrollment.organizationId,
                  type: "completion",
                  status: "pending",
                  recipientEmail: userData.email,
                  scheduledFor: FieldValue.serverTimestamp(),
                  retryCount: 0,
                  metadata: {
                    campaignTitle: campaign.title,
                    userName: userData.name || userData.email,
                  },
                  createdAt: FieldValue.serverTimestamp(),
                  updatedAt: FieldValue.serverTimestamp(),
                });
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error("❌ Error checking campaign completion", error);
    }
  }
);

/**
 * Cloud Function: Send Manual Email
 * Callable function to send emails from the admin UI
 */
interface SendManualEmailRequest {
  campaignId: string;
  type: 'invitation' | 'reminder' | 'custom';
  recipientUserIds?: string[];
  recipientEmails?: string[];
  subject?: string;
  message?: string;
}

export const sendManualEmail = onCall({ cors: true }, async (request) => {
  // Auth check
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  const data = request.data as SendManualEmailRequest;
  const { campaignId, type, recipientUserIds, recipientEmails, subject, message } = data;

  if (!campaignId) {
    throw new HttpsError('invalid-argument', 'Campaign ID is required');
  }

  logger.info(`📧 Sending manual ${type} email for campaign ${campaignId}`);

  try {
    // Get campaign data
    const campaignDoc = await db.collection('campaigns').doc(campaignId).get();
    const campaign = campaignDoc.data();

    if (!campaign) {
      throw new HttpsError('not-found', 'Campaign not found');
    }

    const appUrl = process.env.CLIENT_APP_URL || 'https://dicode-client.web.app';
    const campaignUrl = `${appUrl}/campaigns/${campaignId}`;

    // Collect all recipient emails
    const emails: { email: string; name: string }[] = [];

    // Get emails from user IDs
    if (recipientUserIds && recipientUserIds.length > 0) {
      for (const userId of recipientUserIds) {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        if (userData?.email) {
          emails.push({ email: userData.email, name: userData.name || userData.email });
        }
      }
    }

    // Add direct emails
    if (recipientEmails && recipientEmails.length > 0) {
      for (const email of recipientEmails) {
        emails.push({ email, name: email });
      }
    }

    // If no specific recipients, get all enrolled users
    if (emails.length === 0) {
      const enrollmentsSnapshot = await db
        .collection('campaignEnrollments')
        .where('campaignId', '==', campaignId)
        .get();

      for (const enrollmentDoc of enrollmentsSnapshot.docs) {
        const enrollment = enrollmentDoc.data();
        const userDoc = await db.collection('users').doc(enrollment.userId).get();
        const userData = userDoc.data();
        if (userData?.email) {
          emails.push({ email: userData.email, name: userData.name || userData.email });
        }
      }
    }

    logger.info(`Sending to ${emails.length} recipients`);

    // Send emails
    const results: { success: number; failed: number } = { success: 0, failed: 0 };

    for (const recipient of emails) {
      try {
        let emailSubject: string;
        let emailHtml: string;

        if (type === 'custom' && subject && message) {
          emailSubject = subject;
          emailHtml = generateEmailTemplate(`
            <p>Hi ${recipient.name},</p>
            ${message}
            <a href="${campaignUrl}" class="button">View Campaign</a>
          `);
        } else if (type === 'invitation') {
          emailSubject = `You're Invited: ${campaign.title}`;
          emailHtml = generateEmailTemplate(`
            <h2>You've been invited to a learning campaign!</h2>
            <p>Hi ${recipient.name},</p>
            <p>You've been enrolled in: <strong>${campaign.title}</strong></p>
            <a href="${campaignUrl}" class="button">Start Campaign</a>
          `);
        } else if (type === 'reminder') {
          emailSubject = `Reminder: ${campaign.title}`;
          emailHtml = generateEmailTemplate(`
            <h2>Reminder: Complete your learning campaign</h2>
            <p>Hi ${recipient.name},</p>
            <p>Don't forget to complete: <strong>${campaign.title}</strong></p>
            <a href="${campaignUrl}" class="button">Continue Campaign</a>
          `);
        } else {
          throw new Error('Invalid email type');
        }

        await sendEmail({
          to: recipient.email,
          subject: emailSubject,
          html: emailHtml,
        });

        // Log the notification
        await db.collection('campaignNotifications').add({
          campaignId,
          userId: null,
          type: type === 'custom' ? 'manual' : type,
          status: 'sent',
          recipientEmail: recipient.email,
          sentAt: FieldValue.serverTimestamp(),
          metadata: {
            campaignTitle: campaign.title,
            userName: recipient.name,
            manualSend: true,
            sentBy: request.auth.uid,
          },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        results.success++;
      } catch (error) {
        logger.error(`Failed to send email to ${recipient.email}:`, error);
        results.failed++;
      }
    }

    return {
      success: true,
      results,
      message: `Sent ${results.success} emails, ${results.failed} failed`,
    };
  } catch (error) {
    logger.error('Error sending manual email:', error);
    throw new HttpsError('internal', String(error));
  }
});

/**
 * Cloud Function: Get Email History
 * Returns notification history for a campaign
 */
export const getEmailHistory = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { campaignId, limit: queryLimit = 50 } = request.data as { campaignId: string; limit?: number };

  if (!campaignId) {
    throw new HttpsError('invalid-argument', 'Campaign ID is required');
  }

  try {
    const notificationsSnapshot = await db
      .collection('campaignNotifications')
      .where('campaignId', '==', campaignId)
      .orderBy('createdAt', 'desc')
      .limit(queryLimit)
      .get();

    const notifications = notificationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.().toISOString() || null,
      sentAt: doc.data().sentAt?.toDate?.().toISOString() || null,
    }));

    return { notifications };
  } catch (error) {
    logger.error('Error getting email history:', error);
    throw new HttpsError('internal', String(error));
  }
});

/**
 * Cloud Function: Process Recurring Campaigns
 * Runs daily at midnight EST to create new instances
 */
export const processRecurringCampaigns = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "America/New_York",
    region: process.env.FUNCTION_REGION ?? "us-central1",
  },
  async () => {
    logger.info("🔄 Processing recurring campaigns...");

    try {
      // Get all published campaigns with recurring frequency
      const campaignsSnapshot = await db
        .collection("campaigns")
        .where("metadata.isPublished", "==", true)
        .get();

      for (const campaignDoc of campaignsSnapshot.docs) {
        const campaign = campaignDoc.data();
        const campaignId = campaignDoc.id;

        // Skip if not recurring
        if (campaign.schedule?.frequency === "once") {
          continue;
        }

        const frequency = campaign.schedule?.frequency;
        const startDate = campaign.schedule?.startDate;

        if (!frequency || !startDate) {
          continue;
        }

        // Get existing instances to determine next instance number
        const instancesSnapshot = await db
          .collection("campaignInstances")
          .where("parentCampaignId", "==", campaignId)
          .orderBy("instanceNumber", "desc")
          .limit(1)
          .get();

        const lastInstanceNumber = instancesSnapshot.empty
          ? 0
          : instancesSnapshot.docs[0].data().instanceNumber;

        const nextInstanceNumber = lastInstanceNumber + 1;

        // Create new instance
        await db.collection("campaignInstances").add({
          parentCampaignId: campaignId,
          instanceNumber: nextInstanceNumber,
          startDate: FieldValue.serverTimestamp(), // simplified
          status: "active",
          createdAt: FieldValue.serverTimestamp(),
        });

        logger.info(`✅ Created instance ${nextInstanceNumber} for campaign ${campaignId}`);
      }
    } catch (error) {
      logger.error("❌ Error processing recurring campaigns", error);
    }
  }
);

// ============================================
// AI COPILOT CLOUD FUNCTION
// ============================================

// Initialize OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'mock-key',
});

interface CopilotRequest {
  question: string;
  context?: any;
}

// Mock Vector DB Query
async function queryVectorDB(vector: number[], topK: number = 5) {
  // In a real implementation, this would query Pinecone/Weaviate/etc.
  // For now, we return some hardcoded "company knowledge" to demonstrate RAG.

  const mockDocs = [
    {
      text: "Inclusion Performance: The Marketing department is performing well in terms of inclusion (blue shading), while Technology and Customer Service are underperforming (orange/brown).",
      score: 0.9
    },
    {
      text: "Collaboration: Most departments, including Marketing, Operations, and HR, are performing well in promoting collaboration.",
      score: 0.85
    },
    {
      text: "Healthy Norms: Technology and Customer Service show underperformance in 'Establishing Healthy Norms'. This points to culture challenges.",
      score: 0.82
    },
    {
      text: "Leadership Tips: Effective mentorship begins with active listening. Leaders should provide constructive feedback and celebrate achievements.",
      score: 0.80
    },
    {
      text: "Company Policy: We offer flexible work arrangements, such as hybrid models, to balance company goals with employee needs.",
      score: 0.78
    }
  ];

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return mockDocs;
}

export const askCompanyBot = onCall({ cors: true }, async (request) => {
  // 1. Auth Check
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const data = request.data as CopilotRequest;
  const userQuestion = data.question;

  if (!userQuestion) {
    throw new HttpsError(
      'invalid-argument',
      'The function must be called with a "question" argument.'
    );
  }

  try {
    // 2. Create Embedding
    let vector: number[] = [];

    if (openai.apiKey === 'mock-key') {
      console.log('Using mock embedding for demonstration');
      vector = new Array(1536).fill(0); // Mock vector
    } else {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: userQuestion,
      });
      vector = embeddingResponse.data[0].embedding;
    }

    // 3. Query Vector DB
    const relevantDocs = await queryVectorDB(vector);

    // 4. Build Prompt
    const contextText = relevantDocs.map((doc, index) => `Source ${index + 1}:\n${doc.text}`).join("\n\n---\n\n");

    const systemPrompt = `You are the official company assistant for DiCode.
You answer using ONLY the provided company knowledge sources.
If the answer is not in the sources, say you don't know.
Keep answers professional, concise, and helpful.`;

    const userPrompt = `CONTEXT:\n${contextText}\n\nQUESTION: ${userQuestion}`;

    // 5. Call Responses API (Chat Completions)
    if (openai.apiKey === 'mock-key') {
      return {
        answer: "I am currently running in mock mode because no OpenAI API key was provided. However, I successfully simulated the RAG flow! I retrieved 5 documents from the mock vector store. Once you add a valid key, I will generate real answers based on them.",
        sources: relevantDocs
      };
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5.1", // As requested
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3, // Lower temperature for more grounded answers
    });

    const answer = completion.choices[0].message.content;

    return {
      answer,
      sources: relevantDocs
    };

  } catch (error: any) {
    console.error('Error in askCompanyBot:', error);
    throw new HttpsError(
      'internal',
      'An error occurred while processing your request.',
      error.message
    );
  }
});


// Cloud Function: Send Invitation Email on Creation
export const onInvitationCreated = onDocumentWritten(
  {
    document: "invitations/{invitationId}",
    region: process.env.FUNCTION_REGION ?? "us-central1",
  },
  async (event) => {
    // Only process new documents (not updates)
    if (!event.data?.after.exists || event.data?.before.exists) {
      logger.info("⏭️ Skipping - not a new invitation");
      return;
    }

    const invitation = event.data.after.data();
    const invitationId = event.params.invitationId;

    if (!invitation) {
      logger.error(`❌ Invitation data is null for ${invitationId}`);
      return;
    }

    logger.info(`📧 Processing new invitation ${invitationId} for ${invitation.email}`);

    try {
      // Get organization details
      const orgDoc = await db.collection("organizations").doc(invitation.organizationId).get();

      if (!orgDoc.exists) {
        logger.error(`❌ Organization ${invitation.organizationId} not found`);
        return;
      }

      const org = orgDoc.data();
      if (!org) {
        logger.error(`❌ Organization data is null`);
        return;
      }

      // Get invitee name or use "there" as fallback
      const inviteeName = invitation.metadata?.inviteeName || "there";

      // Calculate expiry date for display
      // Firestore Timestamps have a toDate() method or seconds property
      const expiryDate = invitation.expiresAt?.toDate
        ? invitation.expiresAt.toDate().toLocaleDateString()
        : invitation.expiresAt?.seconds
          ? new Date(invitation.expiresAt.seconds * 1000).toLocaleDateString()
          : new Date(invitation.expiresAt).toLocaleDateString();

      // Get password reset link from invitation
      const passwordResetLink = invitation.passwordResetLink;

      if (!passwordResetLink) {
        logger.error(`❌ No password reset link found for invitation ${invitationId}`);
        return;
      }

      // Send invitation email
      const emailContent = `
        <h2>You've been invited to join ${org.name}!</h2>
        <p>Hi ${inviteeName},</p>
        <p>You've been invited to join <strong>${org.name}</strong> on DiCode.</p>
        <p>To get started, you'll need to set your password and complete your profile.</p>

        <div style="margin: 30px 0; text-align: center;">
          <a href="${passwordResetLink}" class="button" style="display: inline-block; padding: 14px 32px; background-color: #F5BC1D; color: #04060A; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
            Set Your Password & Get Started
          </a>
        </div>

        <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #F5BC1D;">
          <p style="margin: 0 0 10px 0; font-weight: 600; color: #212529;">What happens next?</p>
          <ol style="margin: 0; padding-left: 20px; color: #495057;">
            <li style="margin-bottom: 8px;">Click the button above to set your password</li>
            <li style="margin-bottom: 8px;">Complete your employee profile</li>
            <li>Start exploring your learning modules!</li>
          </ol>
        </div>

        <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
          <p style="margin: 0; font-size: 14px; color: #856404;">
            <strong>Your login email:</strong> ${invitation.email}
          </p>
        </div>

        <p style="margin-top: 30px; color: #6c757d; font-size: 14px;">
          <strong>Note:</strong> For security reasons, the link above expires in 1 hour.
        </p>
        <p style="margin-top: 8px; color: #6c757d; font-size: 14px;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      `;

      await sendEmail({
        to: invitation.email,
        subject: `You're invited to join ${org.name} on DiCode`,
        html: generateEmailTemplate(emailContent),
      });

      logger.info(`✅ Invitation email sent to ${invitation.email}`);
    } catch (error) {
      logger.error(`❌ Failed to send invitation email for ${invitationId}`, error);
      // Don't throw - we don't want to retry indefinitely
      // The invitation still exists and user can manually copy the link
    }
  }
);

/**
 * Cloud Function to create employee Firebase Auth accounts and Firestore user documents
 * This prevents the client-side auth state from being affected and bypasses Firestore security rules
 * Also generates a password reset link for the employee to set their own password
 */
export const createEmployeeAccount = onCall(
  {
    cors: true,
    invoker: "public", // Allow unauthenticated invocations (Firebase Auth is handled separately)
  },
  async (request) => {
    try {
      const { email, role, name, organization, department } = request.data;

      if (!email) {
        throw new Error("Email is required");
      }

      if (!role || !name || !organization) {
        throw new Error("Role, name, and organization are required");
      }

      logger.info(`[createEmployeeAccount] Creating account for: ${email}`);

      // Generate a secure random password (user will never see this)
      const randomPassword = randomBytes(32).toString("hex");

      // Step 1: Create Firebase Auth account (doesn't affect client auth state)
      const userRecord = await getAuth().createUser({
        email: email.toLowerCase(),
        password: randomPassword,
        emailVerified: false,
      });

      logger.info(`✅ Firebase Auth account created: ${userRecord.uid}`);

      // Step 2: Generate password reset link (valid for 1 hour)
      // Employee invitation links should go to the Client App
      const appUrl = process.env.CLIENT_APP_URL || "https://dicode-client.web.app";

      // Generate Firebase password reset link
      const firebaseResetLink = await getAuth().generatePasswordResetLink(
        email.toLowerCase(),
        {
          url: `${appUrl}/login`, // Where to go AFTER password is set
        }
      );

      // Extract oobCode from Firebase link to create our custom link
      const url = new URL(firebaseResetLink);
      const oobCode = url.searchParams.get('oobCode');

      if (!oobCode) {
        throw new Error('Failed to extract oobCode from password reset link');
      }

      // Create direct link to our custom password reset page
      const passwordResetLink = `${appUrl}/reset-password?oobCode=${oobCode}`;

      logger.info(`✅ Password reset link generated for: ${email}`);

      // Step 3: Create Firestore user document (bypasses security rules)
      const userDoc = {
        email: email.toLowerCase(),
        role,
        name,
        organization,
        department: department || null,
        requirePasswordChange: false, // User will set password via reset link
        avatar: null,
        gender: null,
        dateOfBirth: null,
        onboardingCompletedAt: null,
        invitationId: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await db.collection("users").doc(userRecord.uid).set(userDoc);

      logger.info(`✅ Firestore user document created: ${userRecord.uid}`);

      return {
        success: true,
        userId: userRecord.uid,
        passwordResetLink: passwordResetLink,
      };
    } catch (error: any) {
      logger.error("❌ Failed to create employee account:", error);

      // Handle specific errors
      if (error.code === "auth/email-already-exists") {
        throw new Error("An account with this email already exists");
      }

      throw new Error(`Failed to create account: ${error.message}`);
    }
  }
);

/**
 * Cloud Function to delete employee Firebase Auth account
 * This requires admin privileges which the client doesn't have
 */
export const deleteEmployeeAccount = onCall(
  {
    cors: true,
    invoker: "public",
  },
  async (request) => {
    try {
      const { userId, email } = request.data;

      if (!userId && !email) {
        throw new HttpsError("invalid-argument", "Either userId or email is required");
      }

      let targetUserId = userId;

      // If email is provided but not userId, look up the user
      if (!targetUserId && email) {
        try {
          const userRecord = await getAuth().getUserByEmail(email.toLowerCase());
          targetUserId = userRecord.uid;
        } catch (error: any) {
          if (error.code === "auth/user-not-found") {
            logger.info(`[deleteEmployeeAccount] User not found by email: ${email} - may already be deleted`);
            return { success: true, message: "User not found or already deleted" };
          }
          throw error;
        }
      }

      logger.info(`[deleteEmployeeAccount] Deleting Firebase Auth account: ${targetUserId}`);

      // Delete Firebase Auth account
      try {
        await getAuth().deleteUser(targetUserId);
        logger.info(`✅ Firebase Auth account deleted: ${targetUserId}`);
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          logger.info(`[deleteEmployeeAccount] Auth user not found: ${targetUserId} - may already be deleted`);
        } else {
          throw error;
        }
      }

      // Also delete Firestore user document if it exists
      try {
        await db.collection("users").doc(targetUserId).delete();
        logger.info(`✅ Firestore user document deleted: ${targetUserId}`);
      } catch (error: any) {
        logger.warn(`Could not delete Firestore user document: ${error.message}`);
      }

      return {
        success: true,
        deletedUserId: targetUserId,
      };
    } catch (error: any) {
      logger.error("❌ Failed to delete employee account:", error);
      throw new HttpsError("internal", `Failed to delete account: ${error.message}`);
    }
  }
);

/**
 * Cloud Function: Request Password Reset with Beautiful Email
 * Generates a password reset link and sends a beautifully designed email via SendGrid
 */
export const requestPasswordReset = onCall(
  {
    cors: true,
    invoker: "public",
  },
  async (request) => {
    const { email } = request.data;

    if (!email) {
      throw new HttpsError("invalid-argument", "Email is required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    logger.info(`[requestPasswordReset] Processing reset request for: ${normalizedEmail}`);

    try {
      // Check if user exists in Firebase Auth
      let userRecord;
      try {
        userRecord = await getAuth().getUserByEmail(normalizedEmail);
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          // Don't reveal if user exists - return success anyway
          logger.info(`User not found: ${normalizedEmail} - returning success for security`);
          return { success: true, message: "If an account exists, a reset email will be sent." };
        }
        throw error;
      }

      // Get user profile for personalization
      const userDoc = await db.collection("users").doc(userRecord.uid).get();
      const userData = userDoc.data();
      const userName = userData?.name || normalizedEmail.split("@")[0];

      // Generate password reset link - goes to Client App
      const appUrl = process.env.CLIENT_APP_URL || "https://dicode-client.web.app";
      const firebaseResetLink = await getAuth().generatePasswordResetLink(
        normalizedEmail,
        {
          url: `${appUrl}/login`,
        }
      );

      // Extract oobCode and create custom link
      const url = new URL(firebaseResetLink);
      const oobCode = url.searchParams.get("oobCode");

      if (!oobCode) {
        throw new Error("Failed to generate reset link");
      }

      const resetLink = `${appUrl}/reset-password?oobCode=${oobCode}`;

      // Send beautiful email via SendGrid
      const emailContent = `
        <h2>Reset Your Password</h2>
        <p>Hi <strong>${userName}</strong>,</p>
        <p>We received a request to reset your DiCode account password. Click the button below to create a new password:</p>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${resetLink}" class="button" style="display: inline-block; padding: 14px 32px; background-color: #F5BC1D; color: #04060A; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
            Reset Password
          </a>
        </div>
        
        <p style="margin-top: 20px; color: #6c757d; font-size: 14px;">
          If the button doesn't work, copy and paste this link into your browser:<br/>
          <a href="${resetLink}" style="color: #667eea; word-break: break-all;">${resetLink}</a>
        </p>
        
        <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #6c757d;">
          <p style="margin: 0; font-size: 14px; color: #6c757d;">
            <strong>Didn't request this?</strong><br/>
            If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
        </div>
        
        <p style="margin-top: 20px; color: #6c757d; font-size: 14px;">
          This link will expire in 1 hour for security reasons.
        </p>
      `;

      await sendEmail({
        to: normalizedEmail,
        subject: "Reset Your DiCode Password",
        html: generateEmailTemplate(emailContent),
      });

      logger.info(`✅ Password reset email sent to ${normalizedEmail}`);

      return { success: true, message: "Password reset email sent successfully." };
    } catch (error: any) {
      logger.error(`❌ Failed to process password reset for ${normalizedEmail}:`, error);

      // Don't reveal specific errors to the client
      return { success: true, message: "If an account exists, a reset email will be sent." };
    }
  }
);

/**
 * Cloud Function: Resend Invitation
 * Allows users with expired links to request a new one
 */
export const resendInvitation = onCall(
  {
    cors: true,
    invoker: "public",
  },
  async (request) => {
    const { email } = request.data;

    if (!email) {
      throw new HttpsError("invalid-argument", "Email is required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    logger.info(`[resendInvitation] Processing resend request for: ${normalizedEmail}`);

    try {
      // Check if there is a pending invitation
      const invitationsSnapshot = await db.collection("invitations")
        .where("email", "==", normalizedEmail)
        .where("status", "==", "pending")
        .limit(1)
        .get();

      if (invitationsSnapshot.empty) {
        // Security: Don't reveal if invitation exists or not
        return { success: true, message: "If a valid pending invitation exists, a new link will be sent." };
      }

      const invitationDoc = invitationsSnapshot.docs[0];
      const invitationData = invitationDoc.data();

      // Generate new password reset link
      const appUrl = process.env.CLIENT_APP_URL || "https://dicode-client.web.app";
      const firebaseResetLink = await getAuth().generatePasswordResetLink(
        normalizedEmail,
        {
          url: `${appUrl}/login`,
        }
      );

      const url = new URL(firebaseResetLink);
      const oobCode = url.searchParams.get("oobCode");
      const resetLink = `${appUrl}/reset-password?oobCode=${oobCode}`;

      // Update invitation with new token/expiry info if we were tracking tokens, 
      // but here we just need to send the email with the new link.
      // We update the 'updatedAt' just to keep track of activity.
      await invitationDoc.ref.update({
        updatedAt: FieldValue.serverTimestamp(),
        passwordResetLink: resetLink, // Update the stored link just in case
        resendCount: FieldValue.increment(1),
      });

      // Get organization name
      const organizationId = invitationData.organizationId;
      const orgDoc = await db.collection("organizations").doc(organizationId).get();
      const orgName = orgDoc.data()?.name || "DiCode";
      const inviteeName = invitationData.metadata?.inviteeName || "there";

      // Send invitation email (slightly modified for "Resend")
      const emailContent = `
        <h2>Invitation Link Resent</h2>
        <p>Hi ${inviteeName},</p>
        <p>You requested a new invitation link to join <strong>${orgName}</strong> on DiCode.</p>
        <p>Click the button below to set your password and get started:</p>

        <div style="margin: 30px 0; text-align: center;">
          <a href="${resetLink}" class="button" style="display: inline-block; padding: 14px 32px; background-color: #F5BC1D; color: #04060A; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
            Set Password & Join
          </a>
        </div>

        <p style="margin-top: 20px; color: #6c757d; font-size: 14px;">
          <strong>Note:</strong> For security reasons, this link expires in 1 hour.
        </p>

        <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #F5BC1D;">
          <p style="margin: 0; font-size: 14px; color: #856404;">
            <strong>Your login email:</strong> ${normalizedEmail}
          </p>
        </div>
      `;

      await sendEmail({
        to: normalizedEmail,
        subject: `Start your journey with ${orgName}`,
        html: generateEmailTemplate(emailContent),
      });

      logger.info(`✅ Resent invitation to ${normalizedEmail}`);
      return { success: true, message: "Invitation resent successfully." };

    } catch (error: any) {
      logger.error(`❌ Failed to resend invitation for ${normalizedEmail}:`, error);
      return { success: true, message: "If a valid pending invitation exists, a new link will be sent." };
    }
  }
);

/**
 * Cloud Function: Sync Custom Claims
 * Called after login to ensure user's auth token has the latest organization claim
 * This is needed for Firestore security rules to work with list queries
 */
export const syncCustomClaims = onCall(
  {
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated to sync claims");
    }

    const userId = request.auth.uid;
    logger.info(`🔄 Syncing custom claims for user ${userId}`);

    try {
      // Get user document to get current organization
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        logger.warn(`⚠️ User document not found for ${userId}`);
        return { success: false, message: "User not found" };
      }

      const userData = userDoc.data();
      const organization = userData?.organization || null;
      const role = userData?.role || 'employee';

      // Get current claims
      const auth = getAuth();
      const userRecord = await auth.getUser(userId);
      const currentClaims = userRecord.customClaims || {};

      // Check if claims need updating
      if (currentClaims.organizationId === organization && currentClaims.role === role) {
        logger.info(`✅ Claims already up to date for user ${userId}`);
        return { success: true, updated: false, organizationId: organization };
      }

      // Update claims
      await auth.setCustomUserClaims(userId, {
        ...currentClaims,
        organizationId: organization,
        role: role,
      });

      logger.info(`✅ Custom claims synced for user ${userId}: organizationId=${organization}, role=${role}`);
      return { success: true, updated: true, organizationId: organization };
    } catch (error: any) {
      logger.error(`❌ Failed to sync custom claims for ${userId}:`, error);
      throw new HttpsError("internal", "Failed to sync custom claims");
    }
  }
);

/**
 * Cloud Function to automatically update invitation status when user completes onboarding
 * Triggers when a user document is updated and onboardingCompletedAt is set
 */
export const onUserOnboardingComplete = onDocumentUpdated(
  {
    document: "users/{userId}",
    region: process.env.FUNCTION_REGION ?? "us-central1",
  },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) {
      logger.info("⏭️ Skipping - no data available");
      return;
    }

    // Check if onboardingCompletedAt was just set (transitioned from null/undefined to a value)
    const onboardingJustCompleted =
      !beforeData.onboardingCompletedAt &&
      afterData.onboardingCompletedAt;

    if (!onboardingJustCompleted) {
      return; // Onboarding wasn't just completed, nothing to do
    }

    const userEmail = afterData.email;
    if (!userEmail) {
      logger.warn("⚠️ User has no email address");
      return;
    }

    logger.info(`📝 User ${userEmail} completed onboarding, updating invitation status...`);

    try {
      // Find the pending invitation for this user
      const invitationsSnapshot = await db.collection("invitations")
        .where("email", "==", userEmail.toLowerCase())
        .where("status", "==", "pending")
        .limit(1)
        .get();

      if (invitationsSnapshot.empty) {
        logger.info(`ℹ️ No pending invitation found for ${userEmail}`);
        return;
      }

      const invitationDoc = invitationsSnapshot.docs[0];

      // Update invitation status to 'accepted'
      await invitationDoc.ref.update({
        status: "accepted",
        acceptedAt: FieldValue.serverTimestamp(),
      });

      logger.info(`✅ Updated invitation status to 'accepted' for ${userEmail}`);
    } catch (error) {
      logger.error(`❌ Failed to update invitation status for ${userEmail}:`, error);
      // Don't throw - we don't want to fail the user's onboarding if this fails
    }
  }
);

/**
 * Cloud Function to set custom claims when a user's organization changes
 * This allows security rules to use request.auth.token.organizationId for queries
 */
export const onUserOrganizationChanged = onDocumentUpdated(
  {
    document: "users/{userId}",
    region: process.env.FUNCTION_REGION ?? "us-central1",
  },
  async (event) => {
    const userId = event.params.userId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) {
      return;
    }

    const beforeOrg = beforeData.organization || null;
    const afterOrg = afterData.organization || null;
    const afterRole = afterData.role || 'employee';

    // Check if organization changed
    if (beforeOrg === afterOrg) {
      return;
    }

    logger.info(`🔑 User ${userId} organization changed from ${beforeOrg} to ${afterOrg}, updating custom claims...`);

    try {
      const auth = getAuth();

      // Set custom claims with organizationId and role
      await auth.setCustomUserClaims(userId, {
        organizationId: afterOrg,
        role: afterRole,
      });

      logger.info(`✅ Custom claims set for user ${userId}: organizationId=${afterOrg}, role=${afterRole}`);
    } catch (error) {
      logger.error(`❌ Failed to set custom claims for user ${userId}:`, error);
    }
  }
);

/**
 * Cloud Function to set custom claims when a new user document is created
 * Ensures new users have their organization claim set from the start
 */
export const onUserCreated = onDocumentCreated(
  {
    document: "users/{userId}",
    region: process.env.FUNCTION_REGION ?? "us-central1",
  },
  async (event) => {
    const userId = event.params.userId;
    const userData = event.data?.data();

    if (!userData) {
      return;
    }

    const organization = userData.organization || null;
    const role = userData.role || 'employee';

    if (!organization) {
      logger.info(`ℹ️ New user ${userId} has no organization yet, skipping custom claims`);
      return;
    }

    logger.info(`🔑 Setting custom claims for new user ${userId}: organizationId=${organization}`);

    try {
      const auth = getAuth();

      await auth.setCustomUserClaims(userId, {
        organizationId: organization,
        role: role,
      });

      logger.info(`✅ Custom claims set for new user ${userId}`);
    } catch (error) {
      logger.error(`❌ Failed to set custom claims for new user ${userId}:`, error);
    }
  }
);

// ============================================
// USER STREAK & XP MANAGEMENT CLOUD FUNCTIONS
// ============================================

// Streak milestone thresholds
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365];

// Collection names
const USER_STREAKS_COLLECTION = "userStreaks";
const STREAK_EVENTS_COLLECTION = "streakEvents";

// ============================================
// XP SYSTEM CONFIGURATION
// ============================================

// XP earned for different actions
const XP_VALUES = {
  COMPLETE_MODULE: 25,
  COMPLETE_CAMPAIGN: 100,
  CORRECT_ANSWER: 5,
  PERFECT_MODULE_BONUS: 25,
  STREAK_DAY_BONUS: 5, // Per day in current streak
};

// Level thresholds - quadratic progressive difficulty
// Formula: XP to next level = 600 + (level^2 * 50)
// Exponentially harder - no single campaign is ever enough:
// L1→2: 650 XP, L5→6: 1850 XP, L10→11: 5600 XP, L20→21: 20600 XP, L50→51: 125600 XP
interface LevelInfo {
  level: number;
  title: string;
  tier: "newcomer" | "learner" | "achiever" | "expert" | "master";
  totalXpRequired: number;
  xpToNextLevel: number;
  xpInCurrentLevel: number;
}

/**
 * Calculate XP required to go from level L to L+1
 * Uses quadratic growth for exponentially harder leveling
 */
function getXpForLevel(level: number): number {
  return 600 + level * level * 50;
}

/**
 * Calculate total XP required to reach a specific level
 */
function getXpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;

  let totalXp = 0;
  for (let l = 1; l < level; l++) {
    totalXp += getXpForLevel(l);
  }
  return totalXp;
}

/**
 * Calculate level and progress from total XP
 */
function calculateLevelFromXp(totalXp: number): LevelInfo {
  let level = 1;
  let xpRemaining = totalXp;

  // Find current level by subtracting XP requirements
  while (true) {
    const xpForNextLevel = getXpForLevel(level);
    if (xpRemaining >= xpForNextLevel) {
      xpRemaining -= xpForNextLevel;
      level++;
    } else {
      break;
    }
  }

  // XP remaining in current level is xpRemaining, XP needed is the difference
  const xpToNextLevel = getXpForLevel(level) - xpRemaining;

  // Determine title and tier
  let title: string;
  let tier: "newcomer" | "learner" | "achiever" | "expert" | "master";

  if (level <= 5) {
    title = "Newcomer";
    tier = "newcomer";
  } else if (level <= 15) {
    title = "Learner";
    tier = "learner";
  } else if (level <= 30) {
    title = "Achiever";
    tier = "achiever";
  } else if (level <= 50) {
    title = "Expert";
    tier = "expert";
  } else {
    title = "Master";
    tier = "master";
  }

  return {
    level,
    title,
    tier,
    totalXpRequired: getXpRequiredForLevel(level),
    xpToNextLevel,
    xpInCurrentLevel: xpRemaining,
  };
}

/**
 * Calculate streak multiplier (up to 1.5x at 30+ days)
 */
function getStreakMultiplier(currentStreak: number): number {
  if (currentStreak <= 0) return 1;
  // Linear increase: 1.0 at day 1, 1.5 at day 30+
  return Math.min(1 + (currentStreak - 1) * (0.5 / 29), 1.5);
}

// Helper: Get today's date string in YYYY-MM-DD format
function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

// Helper: Get yesterday's date string in YYYY-MM-DD format
function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

// Helper: Log a streak event
async function logStreakEvent(
  userId: string,
  streakId: string,
  eventType: "streak_started" | "streak_continued" | "streak_broken" | "milestone_reached",
  streakLength: number,
  campaignId?: string,
  milestone?: number
): Promise<void> {
  try {
    await db.collection(STREAK_EVENTS_COLLECTION).add({
      userId,
      streakId,
      eventType,
      eventDate: getTodayDateString(),
      streakLength,
      campaignId: campaignId || null,
      milestone: milestone || null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error("Error logging streak event:", error);
  }
}

// Helper: Get active streak for a user
async function getActiveStreak(userId: string): Promise<any | null> {
  const snapshot = await db
    .collection(USER_STREAKS_COLLECTION)
    .where("userId", "==", userId)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

// Helper: Get user streak history
async function getUserStreakHistory(userId: string): Promise<any[]> {
  const snapshot = await db
    .collection(USER_STREAKS_COLLECTION)
    .where("userId", "==", userId)
    .orderBy("startDate", "desc")
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Record a campaign completion and update streak accordingly.
 * Creates/updates userStreaks collection for historical data.
 */
async function recordCampaignCompletion(
  userId: string,
  organizationId: string,
  campaignId: string
): Promise<{
  isNewStreak: boolean;
  milestonesAchieved: number[];
  streakBroken: boolean;
  streakLength: number;
}> {
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  // Get current active streak
  const activeStreak = await getActiveStreak(userId);

  let isNewStreak = false;
  let streakBroken = false;
  const milestonesAchieved: number[] = [];
  let streakLength = 1;

  if (!activeStreak) {
    // No active streak - start a new one
    isNewStreak = true;
    const docRef = await db.collection(USER_STREAKS_COLLECTION).add({
      userId,
      organizationId,
      startDate: today,
      endDate: null,
      length: 1,
      status: "active",
      activeDates: [today],
      completedCampaignIds: [campaignId],
      longestInHistory: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await logStreakEvent(userId, docRef.id, "streak_started", 1, campaignId);
    streakLength = 1;
  } else {
    const lastActivityDate =
      activeStreak.activeDates?.[activeStreak.activeDates.length - 1];

    if (lastActivityDate === today) {
      // Already completed something today - just add the campaign to the list
      const updatedCampaignIds = [
        ...new Set([...(activeStreak.completedCampaignIds || []), campaignId]),
      ];

      await db.collection(USER_STREAKS_COLLECTION).doc(activeStreak.id).update({
        completedCampaignIds: updatedCampaignIds,
        updatedAt: FieldValue.serverTimestamp(),
      });

      streakLength = activeStreak.length;
    } else if (lastActivityDate === yesterday) {
      // Continuing streak from yesterday
      const newLength = activeStreak.length + 1;
      const updatedActiveDates = [...(activeStreak.activeDates || []), today];
      const updatedCampaignIds = [
        ...new Set([...(activeStreak.completedCampaignIds || []), campaignId]),
      ];

      await db.collection(USER_STREAKS_COLLECTION).doc(activeStreak.id).update({
        length: newLength,
        activeDates: updatedActiveDates,
        completedCampaignIds: updatedCampaignIds,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await logStreakEvent(
        userId,
        activeStreak.id,
        "streak_continued",
        newLength,
        campaignId
      );

      // Check for milestone achievements
      for (const milestone of STREAK_MILESTONES) {
        if (newLength >= milestone && activeStreak.length < milestone) {
          milestonesAchieved.push(milestone);
          await logStreakEvent(
            userId,
            activeStreak.id,
            "milestone_reached",
            newLength,
            campaignId,
            milestone
          );
        }
      }

      streakLength = newLength;
    } else {
      // Gap in activity - streak was broken, end old streak and start new one
      streakBroken = true;

      // Check if old streak was the longest
      const allStreaks = await getUserStreakHistory(userId);
      const maxOtherLength = Math.max(
        ...allStreaks.filter((s) => s.id !== activeStreak.id).map((s) => s.length || 0),
        0
      );
      const wasLongest = activeStreak.length > maxOtherLength;

      // End the old streak
      await db.collection(USER_STREAKS_COLLECTION).doc(activeStreak.id).update({
        status: "broken",
        endDate: lastActivityDate,
        longestInHistory: wasLongest,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await logStreakEvent(
        userId,
        activeStreak.id,
        "streak_broken",
        activeStreak.length
      );

      // Start a new streak
      isNewStreak = true;
      const docRef = await db.collection(USER_STREAKS_COLLECTION).add({
        userId,
        organizationId,
        startDate: today,
        endDate: null,
        length: 1,
        status: "active",
        activeDates: [today],
        completedCampaignIds: [campaignId],
        longestInHistory: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await logStreakEvent(userId, docRef.id, "streak_started", 1, campaignId);
      streakLength = 1;
    }
  }

  return {
    isNewStreak,
    milestonesAchieved,
    streakBroken,
    streakLength,
  };
}

/**
 * Triggered when an enrollment document is updated
 * Handles:
 * - Module completion XP (when completedModules increases)
 * - Campaign completion XP + streak (when status changes to 'completed')
 */
export const onEnrollmentStatusChanged = onDocumentUpdated(
  {
    document: "campaignEnrollments/{enrollmentId}",
    region: process.env.FUNCTION_REGION ?? "us-central1",
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const userId = after.userId;
    const campaignId = after.campaignId;
    const organizationId = after.organizationId;

    // Check for module completion (completedModules increased)
    const previousModules = before.completedModules || 0;
    const currentModules = after.completedModules || 0;
    const newModulesCompleted = currentModules - previousModules;

    if (newModulesCompleted > 0) {
      logger.info(`📚 ${newModulesCompleted} module(s) completed for user ${userId}`);

      try {
        // Award XP for each newly completed module
        const moduleXpResult = await awardModuleCompletionXp(userId, organizationId, newModulesCompleted);
        logger.info(`💎 Module XP awarded: ${moduleXpResult.xpEarned} (total: ${moduleXpResult.totalXp})`);
      } catch (error) {
        logger.error(`❌ Error awarding module XP for user ${userId}:`, error);
      }
    }

    // Check for campaign completion (status changed to 'completed')
    if (before.status !== "completed" && after.status === "completed") {
      logger.info(`🎯 Campaign completed for user ${userId}, campaign ${campaignId}`);

      try {
        // 1. Record to historical userStreaks collection
        const streakResult = await recordCampaignCompletion(userId, organizationId, campaignId);
        logger.info(`📊 Streak result: ${JSON.stringify(streakResult)}`);

        if (streakResult.milestonesAchieved.length > 0) {
          logger.info(`🏆 Milestones achieved: ${streakResult.milestonesAchieved.join(", ")}`);
        }

        // 2. Award XP for campaign completion (bonus on top of module XP)
        const xpResult = await awardCampaignCompletionXp(userId, organizationId, streakResult.streakLength);
        logger.info(`💎 Campaign XP awarded: ${xpResult.xpEarned} (total: ${xpResult.totalXp}, level: ${xpResult.level})`);

        // 2b. Calculate and store total XP earned for this campaign on the enrollment document
        // Total = module XP (already awarded) + campaign bonus XP (just awarded)
        const modulesCompleted = after.completedModules || 0;
        const streakMultiplier = getStreakMultiplier(streakResult.streakLength);
        const moduleXpTotal = Math.round(modulesCompleted * XP_VALUES.COMPLETE_MODULE * streakMultiplier);
        const totalCampaignXp = moduleXpTotal + xpResult.xpEarned;

        // Update the enrollment document with XP earned
        await event.data?.after.ref.update({
          xpEarned: totalCampaignXp,
        });
        logger.info(`💾 Stored xpEarned=${totalCampaignXp} on enrollment (modules: ${moduleXpTotal}, campaign bonus: ${xpResult.xpEarned})`);

        // 3. Update computed userStats collection
        await updateUserStreakStats(userId);
        logger.info(`✅ Updated stats for user ${userId}`);

        // 4. Check and award badges
        const skills = await getUserSkillsForBadges(userId);

        // Count total completed campaigns (including this one)
        const totalCampaigns = (await db.collection("campaignEnrollments")
          .where("userId", "==", userId)
          .where("status", "==", "completed")
          .get()).size;

        // First completion is when this is their only completed campaign
        const isFirstCompletion = totalCampaigns === 1;

        const newBadges = await checkAndAwardBadges(userId, {
          currentStreak: streakResult.streakLength,
          totalCampaigns,
          level: xpResult.level,
          skills,
          completionTime: new Date(),
          isFirstCompletion,
        });

        if (newBadges.length > 0) {
          logger.info(`🏆 User ${userId} earned ${newBadges.length} badge(s)!`);
        }

        // 5. Send campaign completion notification
        const campaignDoc = await db.collection("campaigns").doc(campaignId).get();
        const campaignTitle = campaignDoc.data()?.title || "Campaign";
        await notifyCampaignCompleted(userId, organizationId, campaignId, campaignTitle, xpResult.xpEarned);

        // 6. Send streak milestone notifications (7, 14, 30, 60, 100 days)
        const streakMilestones = [7, 14, 30, 60, 100];
        if (streakMilestones.includes(streakResult.streakLength)) {
          await notifyStreakMilestone(userId, organizationId, streakResult.streakLength);
        }

        // 7. Send level up notification
        if (xpResult.leveledUp) {
          const levelInfo = calculateLevelFromXp(xpResult.totalXp);
          await notifyLevelUp(userId, organizationId, xpResult.level, levelInfo.title);
        }
      } catch (error) {
        logger.error(`❌ Error updating stats for user ${userId}:`, error);
      }
    }
  }
);

/**
 * Award XP for completing module(s)
 */
async function awardModuleCompletionXp(
  userId: string,
  organizationId: string,
  moduleCount: number
): Promise<{ xpEarned: number; totalXp: number; level: number; leveledUp: boolean }> {
  const userStatsRef = db.collection("userStats").doc(userId);
  const userStatsDoc = await userStatsRef.get();
  const currentStats = userStatsDoc.exists ? userStatsDoc.data() : null;

  const previousTotalXp = currentStats?.totalXp || 0;
  const currentStreak = currentStats?.currentStreak || 0;
  const previousLevelInfo = calculateLevelFromXp(previousTotalXp);

  // Calculate XP: base module XP × number of modules × streak multiplier
  const baseXp = XP_VALUES.COMPLETE_MODULE * moduleCount;
  const multiplier = getStreakMultiplier(currentStreak);
  const xpEarned = Math.round(baseXp * multiplier);

  const newTotalXp = previousTotalXp + xpEarned;
  const newLevelInfo = calculateLevelFromXp(newTotalXp);
  const leveledUp = newLevelInfo.level > previousLevelInfo.level;

  // Log level calculation details for debugging
  logger.info(`📊 Level calculation for user ${userId}: totalXp=${newTotalXp}, level=${newLevelInfo.level}, xpInCurrentLevel=${newLevelInfo.xpInCurrentLevel}, xpToNextLevel=${newLevelInfo.xpToNextLevel}, totalXpRequired=${newLevelInfo.totalXpRequired}`);

  // Update stats
  await userStatsRef.set(
    {
      totalXp: newTotalXp,
      level: newLevelInfo.level,
      levelTitle: newLevelInfo.title,
      levelTier: newLevelInfo.tier,
      xpToNextLevel: newLevelInfo.xpToNextLevel,
      xpInCurrentLevel: newLevelInfo.xpInCurrentLevel,
      organizationId,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (leveledUp) {
    logger.info(`🎉 User ${userId} leveled up from modules! ${previousLevelInfo.level} → ${newLevelInfo.level}`);
  }

  return {
    xpEarned,
    totalXp: newTotalXp,
    level: newLevelInfo.level,
    leveledUp,
  };
}

/**
 * Award XP for completing a campaign
 */
async function awardCampaignCompletionXp(
  userId: string,
  organizationId: string,
  currentStreak: number
): Promise<{ xpEarned: number; totalXp: number; level: number; leveledUp: boolean; previousLevel: number }> {
  // Get current user stats
  const userStatsRef = db.collection("userStats").doc(userId);
  const userStatsDoc = await userStatsRef.get();
  const currentStats = userStatsDoc.exists ? userStatsDoc.data() : null;

  const previousTotalXp = currentStats?.totalXp || 0;
  const previousLevelInfo = calculateLevelFromXp(previousTotalXp);

  // Calculate XP earned
  let baseXp = XP_VALUES.COMPLETE_CAMPAIGN;

  // Apply streak multiplier
  const multiplier = getStreakMultiplier(currentStreak);
  const xpEarned = Math.round(baseXp * multiplier);

  const newTotalXp = previousTotalXp + xpEarned;
  const newLevelInfo = calculateLevelFromXp(newTotalXp);
  const leveledUp = newLevelInfo.level > previousLevelInfo.level;

  // Log level calculation details for debugging
  logger.info(`📊 Campaign level calculation for user ${userId}: totalXp=${newTotalXp}, level=${newLevelInfo.level}, xpInCurrentLevel=${newLevelInfo.xpInCurrentLevel}, xpToNextLevel=${newLevelInfo.xpToNextLevel}, totalXpRequired=${newLevelInfo.totalXpRequired}`);

  // Update stats with new XP (will be fully written by updateUserStreakStats)
  await userStatsRef.set(
    {
      totalXp: newTotalXp,
      level: newLevelInfo.level,
      levelTitle: newLevelInfo.title,
      levelTier: newLevelInfo.tier,
      xpToNextLevel: newLevelInfo.xpToNextLevel,
      xpInCurrentLevel: newLevelInfo.xpInCurrentLevel,
      organizationId,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Log level up event if applicable
  if (leveledUp) {
    logger.info(`🎉 User ${userId} leveled up! ${previousLevelInfo.level} → ${newLevelInfo.level} (${newLevelInfo.title})`);
  }

  return {
    xpEarned,
    totalXp: newTotalXp,
    level: newLevelInfo.level,
    leveledUp,
    previousLevel: previousLevelInfo.level,
  };
}

/**
 * Helper function to calculate and update user streak stats
 */
async function updateUserStreakStats(userId: string): Promise<void> {
  // Get all completed enrollments for this user
  const enrollmentsSnapshot = await db
    .collection("campaignEnrollments")
    .where("userId", "==", userId)
    .where("status", "==", "completed")
    .get();

  // Extract completion dates
  const completionDates = new Set<string>();

  enrollmentsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.completedAt) {
      const completedDate = data.completedAt.toDate
        ? data.completedAt.toDate()
        : new Date(data.completedAt);
      const dateStr = completedDate.toISOString().split("T")[0];
      completionDates.add(dateStr);
    }
  });

  // Sort dates in descending order
  const sortedDates = Array.from(completionDates).sort().reverse();

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const completedToday = sortedDates.includes(today);
  const completedYesterday = sortedDates.includes(yesterday);

  // Calculate current streak
  let currentStreak = 0;
  let lastDate: Date | null = null;

  if (sortedDates.length > 0 && (completedToday || completedYesterday)) {
    currentStreak = 1;
    lastDate = new Date(sortedDates[0]);

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

  const streakAtRisk = !completedToday && completedYesterday && currentStreak > 0;

  // Calculate streak days for current week (Mon-Sun)
  const streakDays = calculateStreakDaysForWeek(completionDates);

  // Calculate longest streak ever
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  // Sort ascending for longest streak calculation
  const sortedAsc = Array.from(completionDates).sort();
  for (const dateStr of sortedAsc) {
    const currentDate = new Date(dateStr);
    if (prevDate) {
      const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    prevDate = currentDate;
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  // Get existing stats to preserve XP data
  const userStatsRef = db.collection("userStats").doc(userId);
  const existingStats = await userStatsRef.get();
  const existingData = existingStats.exists ? existingStats.data() : null;

  // Preserve XP data if it exists, otherwise initialize
  const totalXp = existingData?.totalXp || 0;
  const levelInfo = calculateLevelFromXp(totalXp);

  // Log level calculation details for debugging
  logger.info(`📊 updateUserStreakStats level calculation for user ${userId}: totalXp=${totalXp}, level=${levelInfo.level}, xpInCurrentLevel=${levelInfo.xpInCurrentLevel}, xpToNextLevel=${levelInfo.xpToNextLevel}, totalXpRequired=${levelInfo.totalXpRequired}`);

  // Store user stats (preserving XP fields)
  await userStatsRef.set(
    {
      userId,
      // Streak data
      currentStreak,
      completedToday,
      streakAtRisk,
      streakDays,
      longestStreak,
      totalCompletedCampaigns: enrollmentsSnapshot.size,
      lastCompletionDate: sortedDates[0] || null,
      completionDates: sortedDates.slice(0, 365), // Keep last year of dates
      // XP data (preserved or initialized)
      totalXp,
      level: levelInfo.level,
      levelTitle: levelInfo.title,
      levelTier: levelInfo.tier,
      xpToNextLevel: levelInfo.xpToNextLevel,
      xpInCurrentLevel: levelInfo.xpInCurrentLevel,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Helper function to calculate streak days for current week
 */
function calculateStreakDaysForWeek(completionDates: Set<string>): boolean[] {
  const streakDays = [false, false, false, false, false, false, false];

  // Get the start of the current week (Monday)
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  // Check each day of the current week
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(monday);
    checkDate.setDate(monday.getDate() + i);
    const dateStr = checkDate.toISOString().split("T")[0];

    if (completionDates.has(dateStr)) {
      streakDays[i] = true;
    }
  }

  return streakDays;
}

/**
 * Callable function to get user stats (for initial load or manual refresh)
 */
export const getUserStatsFunction = onCall({ cors: true }, async (request) => {
  const { userId } = request.data as { userId: string };

  if (!userId) {
    throw new HttpsError("invalid-argument", "userId is required");
  }

  try {
    // First, try to get cached stats
    const userStatsDoc = await db.collection("userStats").doc(userId).get();

    if (userStatsDoc.exists) {
      const stats = userStatsDoc.data();
      return {
        success: true,
        stats: {
          // Streak data
          currentStreak: stats?.currentStreak || 0,
          completedToday: stats?.completedToday || false,
          streakAtRisk: stats?.streakAtRisk || false,
          streakDays: stats?.streakDays || [false, false, false, false, false, false, false],
          longestStreak: stats?.longestStreak || 0,
          totalCompletedCampaigns: stats?.totalCompletedCampaigns || 0,
          lastCompletionDate: stats?.lastCompletionDate || null,
          // XP data
          totalXp: stats?.totalXp || 0,
          level: stats?.level || 1,
          levelTitle: stats?.levelTitle || "Newcomer",
          levelTier: stats?.levelTier || "newcomer",
          xpToNextLevel: stats?.xpToNextLevel || 100,
          xpInCurrentLevel: stats?.xpInCurrentLevel || 0,
        },
      };
    }

    // If no cached stats, calculate fresh
    await updateUserStreakStats(userId);

    const freshStats = await db.collection("userStats").doc(userId).get();
    const stats = freshStats.data();

    return {
      success: true,
      stats: {
        // Streak data
        currentStreak: stats?.currentStreak || 0,
        completedToday: stats?.completedToday || false,
        streakAtRisk: stats?.streakAtRisk || false,
        streakDays: stats?.streakDays || [false, false, false, false, false, false, false],
        longestStreak: stats?.longestStreak || 0,
        totalCompletedCampaigns: stats?.totalCompletedCampaigns || 0,
        lastCompletionDate: stats?.lastCompletionDate || null,
        // XP data
        totalXp: stats?.totalXp || 0,
        level: stats?.level || 1,
        levelTitle: stats?.levelTitle || "Newcomer",
        levelTier: stats?.levelTier || "newcomer",
        xpToNextLevel: stats?.xpToNextLevel || 100,
        xpInCurrentLevel: stats?.xpInCurrentLevel || 0,
      },
    };
  } catch (error) {
    logger.error("Error getting user stats:", error);
    throw new HttpsError("internal", "Failed to get user stats");
  }
});

/**
 * Scheduled function to refresh streak stats daily (handles day rollovers)
 * Runs at midnight EST to update streakAtRisk and completedToday for all users
 */
export const refreshDailyStreakStats = onSchedule(
  {
    schedule: "0 0 * * *", // Every day at midnight
    timeZone: "America/New_York",
    region: process.env.FUNCTION_REGION ?? "us-central1",
  },
  async () => {
    logger.info("🔄 Refreshing daily streak stats...");

    try {
      const userStatsSnapshot = await db.collection("userStats").get();

      const updatePromises: Promise<void>[] = [];

      for (const doc of userStatsSnapshot.docs) {
        const userId = doc.id;
        updatePromises.push(updateUserStreakStats(userId));
      }

      await Promise.all(updatePromises);
      logger.info(`✅ Refreshed streak stats for ${userStatsSnapshot.size} users`);
    } catch (error) {
      logger.error("❌ Error refreshing daily streak stats:", error);
    }
  }
);

// ============================================
// BADGE SYSTEM
// ============================================

// Badge definitions
interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'completion' | 'level' | 'skill' | 'special';
  criteria: {
    type: 'streak' | 'modules' | 'campaigns' | 'xp' | 'level' | 'skill_mastery' | 'time_based' | 'first_completion';
    threshold?: number;
    skillLevel?: number;
    timeCondition?: 'night_owl' | 'early_bird';
  };
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Streak Badges
  { id: 'streak-7', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '🔥', category: 'streak', criteria: { type: 'streak', threshold: 7 } },
  { id: 'streak-30', name: 'Month Master', description: 'Maintain a 30-day streak', icon: '🔥', category: 'streak', criteria: { type: 'streak', threshold: 30 } },
  { id: 'streak-100', name: 'Streak Legend', description: 'Maintain a 100-day streak', icon: '🏆', category: 'streak', criteria: { type: 'streak', threshold: 100 } },

  // Completion Badges
  { id: 'first-completion', name: 'First Steps', description: 'Complete your first campaign', icon: '🎯', category: 'completion', criteria: { type: 'first_completion', threshold: 1 } },
  { id: 'campaigns-5', name: 'Getting Started', description: 'Complete 5 campaigns', icon: '📖', category: 'completion', criteria: { type: 'campaigns', threshold: 5 } },
  { id: 'campaigns-10', name: 'Dedicated Learner', description: 'Complete 10 campaigns', icon: '📚', category: 'completion', criteria: { type: 'campaigns', threshold: 10 } },
  { id: 'campaigns-25', name: 'Knowledge Seeker', description: 'Complete 25 campaigns', icon: '🧠', category: 'completion', criteria: { type: 'campaigns', threshold: 25 } },
  { id: 'campaigns-50', name: 'Learning Champion', description: 'Complete 50 campaigns', icon: '🏅', category: 'completion', criteria: { type: 'campaigns', threshold: 50 } },

  // Level Badges
  { id: 'level-5', name: 'Rising Star', description: 'Reach Level 5', icon: '⭐', category: 'level', criteria: { type: 'level', threshold: 5 } },
  { id: 'level-10', name: 'Achiever', description: 'Reach Level 10', icon: '💫', category: 'level', criteria: { type: 'level', threshold: 10 } },
  { id: 'level-20', name: 'Expert', description: 'Reach Level 20', icon: '💎', category: 'level', criteria: { type: 'level', threshold: 20 } },
  { id: 'level-50', name: 'Master', description: 'Reach Level 50', icon: '👑', category: 'level', criteria: { type: 'level', threshold: 50 } },

  // Skill Mastery Badges
  { id: 'skill-master', name: 'Skill Master', description: 'Reach Level 5 in any skill', icon: '🏅', category: 'skill', criteria: { type: 'skill_mastery', skillLevel: 5 } },
  { id: 'well-rounded', name: 'Well-Rounded', description: 'Reach Level 3+ in 5 different skills', icon: '🎓', category: 'skill', criteria: { type: 'skill_mastery', skillLevel: 3, threshold: 5 } },

  // Special/Time-based Badges
  { id: 'night-owl', name: 'Night Owl', description: 'Complete a campaign after 10pm', icon: '🦉', category: 'special', criteria: { type: 'time_based', timeCondition: 'night_owl' } },
  { id: 'early-bird', name: 'Early Bird', description: 'Complete a campaign before 7am', icon: '🌅', category: 'special', criteria: { type: 'time_based', timeCondition: 'early_bird' } },
];

/**
 * Check and award badges based on current user stats
 * Returns array of newly awarded badge IDs
 */
async function checkAndAwardBadges(
  userId: string,
  context: {
    currentStreak?: number;
    totalCampaigns?: number;
    level?: number;
    skills?: Record<string, { level: number }>;
    completionTime?: Date;
    isFirstCompletion?: boolean;
  }
): Promise<BadgeDefinition[]> {
  const userStatsRef = db.collection("userStats").doc(userId);
  const userStatsDoc = await userStatsRef.get();
  const existingBadges: string[] = userStatsDoc.data()?.badges || [];

  const newBadges: BadgeDefinition[] = [];

  for (const badge of BADGE_DEFINITIONS) {
    // Skip if already earned
    if (existingBadges.includes(badge.id)) {
      continue;
    }

    let earned = false;

    switch (badge.criteria.type) {
      case 'streak':
        if (context.currentStreak && badge.criteria.threshold) {
          earned = context.currentStreak >= badge.criteria.threshold;
        }
        break;

      case 'first_completion':
        earned = context.isFirstCompletion === true;
        break;

      case 'campaigns':
        if (context.totalCampaigns && badge.criteria.threshold) {
          earned = context.totalCampaigns >= badge.criteria.threshold;
        }
        break;

      case 'level':
        if (context.level && badge.criteria.threshold) {
          earned = context.level >= badge.criteria.threshold;
        }
        break;

      case 'skill_mastery':
        if (context.skills && badge.criteria.skillLevel) {
          const skillsAtLevel = Object.values(context.skills).filter(
            (s) => s.level >= badge.criteria.skillLevel!
          );

          if (badge.criteria.threshold) {
            // Multiple skills at level (e.g., well-rounded)
            earned = skillsAtLevel.length >= badge.criteria.threshold;
          } else {
            // Any single skill at level (e.g., skill master)
            earned = skillsAtLevel.length > 0;
          }
        }
        break;

      case 'time_based':
        if (context.completionTime) {
          const hour = context.completionTime.getHours();
          if (badge.criteria.timeCondition === 'night_owl') {
            earned = hour >= 22 || hour < 4; // 10pm - 4am
          } else if (badge.criteria.timeCondition === 'early_bird') {
            earned = hour >= 4 && hour < 7; // 4am - 7am
          }
        }
        break;
    }

    if (earned) {
      newBadges.push(badge);
    }
  }

  // Award new badges
  if (newBadges.length > 0) {
    const newBadgeIds = newBadges.map((b) => b.id);
    const badgeDetails = newBadges.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      category: b.category,
      earnedAt: new Date().toISOString(),
    }));

    // Update userStats with new badges
    await userStatsRef.set(
      {
        badges: [...existingBadges, ...newBadgeIds],
        badgeDetails: FieldValue.arrayUnion(...badgeDetails),
        lastBadgeEarnedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info(`🏆 Awarded ${newBadges.length} badge(s) to user ${userId}: ${newBadgeIds.join(', ')}`);

    // Get user's organizationId for notifications
    const userDoc = await db.collection("users").doc(userId).get();
    const organizationId = userDoc.data()?.organization || '';

    // Create notifications for each badge earned
    if (organizationId) {
      await notifyBadgesEarned(userId, organizationId, newBadges);
    }
  }

  return newBadges;
}

/**
 * Get user's skill data for badge checking
 */
async function getUserSkillsForBadges(userId: string): Promise<Record<string, { level: number }>> {
  const profileDoc = await db.collection(USER_SKILL_PROFILES_COLLECTION).doc(userId).get();
  const skills = profileDoc.data()?.skills || {};

  const result: Record<string, { level: number }> = {};
  for (const [skillId, skillData] of Object.entries(skills)) {
    result[skillId] = { level: (skillData as any).level || 1 };
  }
  return result;
}

// ============================================
// SKILL PROGRESS TRACKING SYSTEM
// ============================================

// Collection names
const SKILL_ASSESSMENTS_COLLECTION = "skillAssessments";
const USER_SKILL_PROFILES_COLLECTION = "userSkillProfiles";

// Skill level thresholds (consecutive assessments above threshold to level up)
// Drastically harder progression - requires sustained excellence over many assessments
const SKILL_LEVEL_THRESHOLDS = {
  2: { consecutiveRequired: 5, minScore: 50 },   // 5 assessments at 50%+
  3: { consecutiveRequired: 10, minScore: 65 },  // 10 assessments at 65%+
  4: { consecutiveRequired: 20, minScore: 80 },  // 20 assessments at 80%+
  5: { consecutiveRequired: 35, minScore: 90 },  // 35 assessments at 90%+ (mastery)
};

// Competency definitions for name lookups
const COMPETENCIES_MAP: Record<string, { name: string; skills: Record<string, string> }> = {
  'psychological-safety': {
    name: 'Foster Psychological Safety',
    skills: {
      'ps-1': 'Mitigate Bias',
      'ps-2': 'Practice Curiosity',
      'ps-3': 'Seek Input',
      'ps-4': 'Manage Power',
    },
  },
  'prosocial-norms': {
    name: 'Establish Prosocial Norms',
    skills: {
      'pn-1': 'Value Diversity',
      'pn-2': 'Show Appreciation',
      'pn-3': 'Ensure Equity',
      'pn-4': 'Build Relationships',
    },
  },
  'collaboration': {
    name: 'Encourage Collaboration',
    skills: {
      'co-1': 'Demonstrate Empathy',
      'co-2': 'Recognize Strengths',
      'co-3': 'Share Decision-making',
      'co-4': 'Promote Allyship',
    },
  },
  'growth': {
    name: 'Prioritize Growth',
    skills: {
      'gr-1': 'Confer Autonomy',
      'gr-2': 'Prioritize Learning',
      'gr-3': 'Embrace Change',
      'gr-4': 'Welcome Feedback',
    },
  },
};

/**
 * Calculate assessment score based on question type
 * Q1 (behavioral-perception): Compare to benchmark
 * Q2 (behavioral-intent): Normalize intent score
 */
function calculateAssessmentScore(
  questionType: string,
  answer: number,
  benchmarkScore?: number,
  scaleMax: number = 5
): number {
  if (questionType === 'behavioral-perception' && benchmarkScore !== undefined) {
    // Q1: Score based on distance from benchmark
    const distance = Math.abs(answer - benchmarkScore);
    const maxDistance = scaleMax - 1;
    return Math.round((1 - distance / maxDistance) * 100);
  } else if (questionType === 'behavioral-intent') {
    // Q2: Normalize intent score (1-7 scale)
    return Math.round((answer / 7) * 100);
  }
  // Default: normalize to 100
  return Math.round((answer / scaleMax) * 100);
}

/**
 * Determine skill level based on consecutive scores
 */
function calculateSkillLevel(
  currentLevel: number,
  consecutiveAboveThreshold: number,
  latestScore: number
): { newLevel: number; newConsecutive: number } {
  let newConsecutive = consecutiveAboveThreshold;
  let newLevel = currentLevel;

  // Check if we can level up
  for (let targetLevel = 5; targetLevel >= 2; targetLevel--) {
    const threshold = SKILL_LEVEL_THRESHOLDS[targetLevel as keyof typeof SKILL_LEVEL_THRESHOLDS];
    if (latestScore >= threshold.minScore) {
      if (targetLevel > currentLevel) {
        // Trying to level up
        newConsecutive = consecutiveAboveThreshold + 1;
        if (newConsecutive >= threshold.consecutiveRequired) {
          newLevel = targetLevel;
          newConsecutive = 0; // Reset for next level
        }
      } else {
        // Maintaining or above current level
        newConsecutive = consecutiveAboveThreshold + 1;
      }
      break;
    }
  }

  // Check for level down (3 consecutive below current level threshold)
  if (currentLevel > 1) {
    const currentThreshold = SKILL_LEVEL_THRESHOLDS[currentLevel as keyof typeof SKILL_LEVEL_THRESHOLDS];
    if (currentThreshold && latestScore < currentThreshold.minScore) {
      newConsecutive = consecutiveAboveThreshold - 1;
      if (newConsecutive <= -3) {
        newLevel = Math.max(1, currentLevel - 1);
        newConsecutive = 0;
      }
    }
  }

  return { newLevel, newConsecutive };
}

/**
 * Get competency name from ID
 */
function getCompetencyName(competencyId: string): string {
  return COMPETENCIES_MAP[competencyId]?.name || competencyId;
}

/**
 * Get skill name from competency and skill IDs
 */
function getSkillName(competencyId: string, skillId: string): string {
  return COMPETENCIES_MAP[competencyId]?.skills[skillId] || skillId;
}

/**
 * Update skill aggregate in user profile
 * Returns level change info for notification purposes
 */
async function updateSkillAggregate(
  userId: string,
  competencyId: string,
  skillId: string,
  newScore: number
): Promise<{ previousLevel: number; newLevel: number; skillName: string }> {
  const profileRef = db.collection(USER_SKILL_PROFILES_COLLECTION).doc(userId);

  let previousLevel = 1;
  let newLevel = 1;
  let skillName = '';

  await db.runTransaction(async (transaction) => {
    const profileDoc = await transaction.get(profileRef);
    const profileData = profileDoc.exists ? profileDoc.data() : {};

    // Get existing skill data or create default
    const skills = profileData?.skills || {};
    skillName = getSkillName(competencyId, skillId);
    const existingSkill = skills[skillId] || {
      skillId,
      skillName,
      competencyId,
      currentScore: 0,
      averageScore: 0,
      assessmentCount: 0,
      level: 1,
      consecutiveAboveThreshold: 0,
      lastAssessedAt: null,
      history: [],
    };

    previousLevel = existingSkill.level;

    // Calculate new average
    const totalScore = existingSkill.averageScore * existingSkill.assessmentCount + newScore;
    const newCount = existingSkill.assessmentCount + 1;
    const newAverage = Math.round(totalScore / newCount);

    // Calculate new level
    const levelResult = calculateSkillLevel(
      existingSkill.level,
      existingSkill.consecutiveAboveThreshold,
      newScore
    );
    newLevel = levelResult.newLevel;

    // Update history (keep last 10)
    const today = new Date().toISOString().split('T')[0];
    const newHistory = [
      { score: newScore, date: today },
      ...(existingSkill.history || []).slice(0, 9),
    ];

    // Update skill data
    const updatedSkill = {
      ...existingSkill,
      currentScore: newScore,
      averageScore: newAverage,
      assessmentCount: newCount,
      level: newLevel,
      consecutiveAboveThreshold: levelResult.newConsecutive,
      lastAssessedAt: FieldValue.serverTimestamp(),
      history: newHistory,
    };

    skills[skillId] = updatedSkill;

    // Update profile
    transaction.set(
      profileRef,
      {
        skills,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info(`📊 Updated skill ${skillId} for user ${userId}: score=${newScore}, level=${newLevel}`);
  });

  return { previousLevel, newLevel, skillName };
}

/**
 * Recalculate competency score from child skills
 */
async function recalculateCompetencyScore(
  userId: string,
  competencyId: string
): Promise<void> {
  const profileRef = db.collection(USER_SKILL_PROFILES_COLLECTION).doc(userId);

  await db.runTransaction(async (transaction) => {
    const profileDoc = await transaction.get(profileRef);
    const profileData = profileDoc.exists ? profileDoc.data() : {};

    const skills = profileData?.skills || {};
    const competencyScores = profileData?.competencyScores || {};

    // Find all skills under this competency
    const competencySkills = Object.values(skills).filter(
      (skill: any) => skill.competencyId === competencyId
    );

    if (competencySkills.length === 0) {
      return;
    }

    // Calculate average score (using skill averageScore for stability, not latest currentScore)
    const totalScore = competencySkills.reduce(
      (sum: number, skill: any) => sum + (skill.averageScore || skill.currentScore || 0),
      0
    );
    const avgScore = Math.round(totalScore / competencySkills.length);

    // Determine competency level (minimum of all skill levels - ALL skills must level up)
    const minLevel = Math.min(
      ...competencySkills.map((skill: any) => skill.level || 1)
    );

    // Get total skills for this competency
    const totalSkillsInCompetency = COMPETENCIES_MAP[competencyId]?.skills
      ? Object.keys(COMPETENCIES_MAP[competencyId].skills).length
      : 4;

    // Update competency score
    competencyScores[competencyId] = {
      competencyId,
      competencyName: getCompetencyName(competencyId),
      currentScore: avgScore,
      level: minLevel,
      skillCount: totalSkillsInCompetency,
      assessedSkillCount: competencySkills.length,
      lastAssessedAt: FieldValue.serverTimestamp(),
    };

    transaction.set(
      profileRef,
      {
        competencyScores,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info(`📊 Updated competency ${competencyId} for user ${userId}: score=${avgScore}, level=${minLevel}`);
  });
}

/**
 * Cloud Function: Track Skill Assessment on Campaign Response
 * Triggered when a user submits a response to a campaign question
 */
export const onCampaignResponseCreated = onDocumentCreated(
  {
    document: "campaignResponses/{responseId}",
    region: process.env.FUNCTION_REGION ?? "us-central1",
  },
  async (event) => {
    const response = event.data?.data();
    const responseId = event.params.responseId;

    if (!response) {
      logger.warn(`⚠️ No response data for ${responseId}`);
      return;
    }

    const {
      userId,
      organizationId,
      campaignId,
      videoId,
    } = response;

    logger.info(`📝 Response created: ${responseId} for video ${videoId}`);

    try {
      // Fetch the video to get all questions and their skill/competency tagging
      const videoDoc = await db.collection('videos').doc(videoId).get();
      if (!videoDoc.exists) {
        logger.warn(`⚠️ Video ${videoId} not found, skipping skill tracking`);
        return;
      }

      const videoData = videoDoc.data();
      const allQuestions = videoData?.questions || [];

      // Find scorable questions (Q1: behavioral-perception, Q2: behavioral-intent)
      const scorableQuestions = allQuestions.filter(
        (q: any) => q.type === 'behavioral-perception' || q.type === 'behavioral-intent'
      );

      if (scorableQuestions.length === 0) {
        logger.info(`ℹ️ Video ${videoId} has no scorable questions, skipping`);
        return;
      }

      // Get skill/competency from Q1 (perception) - all questions share the same skill
      const q1 = allQuestions.find((q: any) => q.type === 'behavioral-perception');
      const competencyId = q1?.competencyId;
      const skillId = q1?.skillId;

      if (!competencyId || !skillId) {
        logger.info(`ℹ️ Video ${videoId} has no skill tagging on Q1, skipping`);
        return;
      }

      // Fetch all responses for this user/campaign/video
      const responsesSnapshot = await db.collection('campaignResponses')
        .where('userId', '==', userId)
        .where('campaignId', '==', campaignId)
        .where('videoId', '==', videoId)
        .get();

      const existingResponses = responsesSnapshot.docs.map(doc => doc.data());

      // Check how many scorable questions have been answered
      const answeredScorableQuestions = existingResponses.filter(
        (r: any) => r.metadata?.questionType === 'behavioral-perception' || r.metadata?.questionType === 'behavioral-intent'
      );

      logger.info(`   Video has ${scorableQuestions.length} scorable questions, ${answeredScorableQuestions.length} answered`);

      // Only proceed if ALL scorable questions are answered
      if (answeredScorableQuestions.length < scorableQuestions.length) {
        logger.info(`ℹ️ Video ${videoId} not complete yet (${answeredScorableQuestions.length}/${scorableQuestions.length}), waiting for more responses`);
        return;
      }

      // Check if we already created a skill assessment for this video (avoid duplicates)
      const existingAssessment = await db.collection(SKILL_ASSESSMENTS_COLLECTION)
        .where('userId', '==', userId)
        .where('campaignId', '==', campaignId)
        .where('videoId', '==', videoId)
        .where('skillId', '==', skillId)
        .limit(1)
        .get();

      if (!existingAssessment.empty) {
        logger.info(`ℹ️ Skill assessment for video ${videoId} already exists, skipping`);
        return;
      }

      logger.info(`🎬 Video ${videoId} complete! Calculating aggregated skill score...`);

      // Calculate scores for each scorable response
      const scores: number[] = [];
      const scoreDetails: { type: string; raw: number; benchmark?: number; score: number }[] = [];

      for (const resp of answeredScorableQuestions) {
        const questionType = resp.metadata?.questionType;
        let numericAnswer: number;

        if (questionType === 'behavioral-intent' && resp.intentScore !== undefined) {
          numericAnswer = resp.intentScore;
        } else if (typeof resp.answer === 'number') {
          numericAnswer = resp.answer;
        } else {
          continue; // Skip non-numeric answers
        }

        // Get benchmark for Q1
        let benchmarkScore: number | undefined;
        if (questionType === 'behavioral-perception') {
          const question = allQuestions.find((q: any) => q.id === resp.questionId);
          benchmarkScore = question?.benchmarkScore;
        }

        const calculatedScore = calculateAssessmentScore(questionType, numericAnswer, benchmarkScore);
        scores.push(calculatedScore);
        // Only include benchmark field when defined (Q1 has benchmark, Q2 doesn't)
        const detail: { type: string; raw: number; benchmark?: number; score: number } = {
          type: questionType,
          raw: numericAnswer,
          score: calculatedScore,
        };
        if (benchmarkScore !== undefined) {
          detail.benchmark = benchmarkScore;
        }
        scoreDetails.push(detail);
      }

      if (scores.length === 0) {
        logger.warn(`⚠️ No valid scores calculated for video ${videoId}`);
        return;
      }

      // Calculate the average score across all scorable questions in the video
      const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

      logger.info(`   Individual scores: ${scoreDetails.map(s => `${s.type}=${s.score}`).join(', ')}`);
      logger.info(`   Aggregated video score: ${averageScore} (average of ${scores.length} questions)`);

      // Store ONE skill assessment per video
      await db.collection(SKILL_ASSESSMENTS_COLLECTION).add({
        userId,
        organizationId,
        competencyId,
        skillId,
        campaignId,
        videoId,
        // Store aggregated data instead of single question data
        aggregatedFrom: scoreDetails.length,
        questionScores: scoreDetails,
        calculatedScore: averageScore,
        assessedAt: FieldValue.serverTimestamp(),
      });

      logger.info(`✅ Stored aggregated skill assessment for ${skillId} (video: ${videoId})`);

      // Update skill aggregate in user profile with the averaged score
      const skillResult = await updateSkillAggregate(userId, competencyId, skillId, averageScore);

      // Send notification if skill leveled up
      if (skillResult.newLevel > skillResult.previousLevel) {
        await notifySkillMastered(
          userId,
          organizationId,
          skillId,
          skillResult.skillName,
          skillResult.newLevel
        );
        logger.info(`🌟 Skill ${skillResult.skillName} leveled up to ${skillResult.newLevel} for user ${userId}`);
      }

      // Recalculate competency score
      await recalculateCompetencyScore(userId, competencyId);

      // Check for skill mastery badges
      const skills = await getUserSkillsForBadges(userId);
      const newBadges = await checkAndAwardBadges(userId, { skills });

      if (newBadges.length > 0) {
        logger.info(`🏆 User ${userId} earned skill badge(s): ${newBadges.map(b => b.name).join(', ')}`);
      }

      logger.info(`✅ Skill tracking complete for video ${videoId}`);
    } catch (error) {
      logger.error(`❌ Error tracking skill assessment for ${responseId}:`, error);
    }
  }
);

/**
 * Callable function to recalculate badges for a user
 * Useful for awarding badges retroactively to users who completed campaigns
 * before the badge system was deployed
 */
export const recalculateBadges = onCall({ cors: true }, async (request) => {
  const userId = request.data?.userId || request.auth?.uid;

  if (!userId) {
    throw new HttpsError("invalid-argument", "User ID is required");
  }

  logger.info(`🔄 Recalculating badges for user ${userId}`);

  try {
    // Get user's current stats
    const userStatsDoc = await db.collection("userStats").doc(userId).get();
    const userStats = userStatsDoc.data() || {};

    // Get total completed campaigns
    const completedEnrollments = await db.collection("campaignEnrollments")
      .where("userId", "==", userId)
      .where("status", "==", "completed")
      .get();
    const totalCampaigns = completedEnrollments.size;

    // Get skill levels
    const skills = await getUserSkillsForBadges(userId);

    // Check for time-based badges from completion history
    let hasNightOwl = false;
    let hasEarlyBird = false;

    completedEnrollments.docs.forEach(doc => {
      const completedAt = doc.data().completedAt?.toDate?.();
      if (completedAt) {
        const hour = completedAt.getHours();
        if (hour >= 22 || hour < 5) hasNightOwl = true;
        if (hour >= 5 && hour < 7) hasEarlyBird = true;
      }
    });

    // Award badges
    const newBadges = await checkAndAwardBadges(userId, {
      currentStreak: userStats.currentStreak || 0,
      totalCampaigns,
      level: userStats.level || 1,
      skills,
      completionTime: hasNightOwl ? new Date(2024, 0, 1, 23, 0) : hasEarlyBird ? new Date(2024, 0, 1, 6, 0) : undefined,
      isFirstCompletion: totalCampaigns >= 1,
    });

    logger.info(`✅ Recalculated badges for user ${userId}: ${newBadges.length} new badges awarded`);

    return {
      success: true,
      newBadges: newBadges.map(b => ({ id: b.id, name: b.name, icon: b.icon })),
      totalBadges: (userStats.badges?.length || 0) + newBadges.length,
    };
  } catch (error) {
    logger.error(`❌ Error recalculating badges for ${userId}:`, error);
    throw new HttpsError("internal", "Failed to recalculate badges");
  }
});

// ============================================
// ORGANIZATION ANALYTICS AGGREGATION
// ============================================

const ORGANIZATION_ANALYTICS_COLLECTION = "organizationAnalytics";
const USER_SKILL_PROFILES_COLLECTION_NAME = "userSkillProfiles";

/**
 * Scheduled function to refresh organization-level analytics daily
 * Aggregates competency scores across all users in each organization
 * Runs at 1 AM EST (after user streak stats refresh at midnight)
 */
export const refreshOrganizationAnalytics = onSchedule(
  {
    schedule: "0 1 * * *", // Every day at 1 AM
    timeZone: "America/New_York",
    region: process.env.FUNCTION_REGION ?? "us-central1",
  },
  async () => {
    logger.info("📊 Refreshing organization analytics...");

    try {
      // Get all unique organizations from users collection
      const usersSnapshot = await db.collection("users").get();
      const organizationIds = new Set<string>();

      usersSnapshot.docs.forEach(doc => {
        const org = doc.data().organization;
        if (org) organizationIds.add(org);
      });

      logger.info(`Found ${organizationIds.size} organizations to process`);

      const updatePromises: Promise<void>[] = [];

      for (const orgId of organizationIds) {
        updatePromises.push(calculateOrganizationAnalytics(orgId));
      }

      await Promise.all(updatePromises);
      logger.info(`✅ Refreshed analytics for ${organizationIds.size} organizations`);
    } catch (error) {
      logger.error("❌ Error refreshing organization analytics:", error);
    }
  }
);

/**
 * Calculate and store analytics for a single organization
 */
async function calculateOrganizationAnalytics(organizationId: string): Promise<void> {
  try {
    // Get all users in this organization
    const usersInOrg = await db.collection("users")
      .where("organization", "==", organizationId)
      .get();

    // Build user-to-department map and department list
    const userDepartments: Record<string, string | null> = {};
    const departmentSet = new Set<string>();

    usersInOrg.docs.forEach(doc => {
      const userData = doc.data();
      const dept = userData.department || null;
      userDepartments[doc.id] = dept;
      if (dept) {
        departmentSet.add(dept);
      }
    });

    const userIds = usersInOrg.docs.map(doc => doc.id);
    const totalEmployees = userIds.length;

    if (totalEmployees === 0) {
      logger.info(`Org ${organizationId} has no users, skipping`);
      return;
    }

    // Helper to create empty competency totals structure
    interface CompetencyStats {
      totalScore: number;
      count: number;
      levels: number[];
    }

    type CompetencyKey = 'psychological-safety' | 'prosocial-norms' | 'collaboration' | 'growth';

    const createCompetencyTotals = (): Record<CompetencyKey, CompetencyStats> => ({
      'psychological-safety': { totalScore: 0, count: 0, levels: [] as number[] },
      'prosocial-norms': { totalScore: 0, count: 0, levels: [] as number[] },
      'collaboration': { totalScore: 0, count: 0, levels: [] as number[] },
      'growth': { totalScore: 0, count: 0, levels: [] as number[] },
    });

    // Type guard for runtime checks
    const isCompetencyKey = (key: string): key is CompetencyKey => {
      return ['psychological-safety', 'prosocial-norms', 'collaboration', 'growth'].includes(key);
    };

    // Aggregate competency scores from userSkillProfiles
    const competencyTotals = createCompetencyTotals();

    // Department-level aggregation structures
    const departmentData: Record<string, {
      totalEmployees: number;
      activeUsers: number;
      competencyTotals: ReturnType<typeof createCompetencyTotals>;
      overallScoreSum: number;
      overallScoreCount: number;
    }> = {};

    // Initialize department data
    departmentSet.forEach(dept => {
      departmentData[dept] = {
        totalEmployees: 0,
        activeUsers: 0,
        competencyTotals: createCompetencyTotals(),
        overallScoreSum: 0,
        overallScoreCount: 0,
      };
    });

    // Count employees per department
    Object.values(userDepartments).forEach(dept => {
      if (dept && departmentData[dept]) {
        departmentData[dept].totalEmployees += 1;
      }
    });

    let overallScoreSum = 0;
    let overallScoreCount = 0;
    let totalActiveUsers = 0;

    // Fetch skill profiles for all users in the org
    // Process in batches of 30 (Firestore 'in' query limit)
    const batchSize = 30;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batchUserIds = userIds.slice(i, i + batchSize);

      const profilesSnapshot = await db.collection(USER_SKILL_PROFILES_COLLECTION_NAME)
        .where("__name__", "in", batchUserIds)
        .get();

      profilesSnapshot.docs.forEach(doc => {
        const userId = doc.id;
        const userDept = userDepartments[userId];
        const profile = doc.data();
        const competencyScores = profile.competencyScores || {};

        let userHasScores = false;

        Object.entries(competencyScores).forEach(([compId, scoreData]: [string, any]) => {
          if (isCompetencyKey(compId) && scoreData.currentScore !== undefined) {
            // Org-wide aggregation
            competencyTotals[compId].totalScore += scoreData.currentScore;
            competencyTotals[compId].count += 1;
            competencyTotals[compId].levels.push(scoreData.level || 1);
            overallScoreSum += scoreData.currentScore;
            overallScoreCount += 1;
            userHasScores = true;

            // Department-level aggregation
            if (userDept && departmentData[userDept]) {
              const deptTotals = departmentData[userDept].competencyTotals;
              if (deptTotals[compId]) {
                deptTotals[compId].totalScore += scoreData.currentScore;
                deptTotals[compId].count += 1;
                deptTotals[compId].levels.push(scoreData.level || 1);
                departmentData[userDept].overallScoreSum += scoreData.currentScore;
                departmentData[userDept].overallScoreCount += 1;
              }
            }
          }
        });

        if (userHasScores) {
          totalActiveUsers += 1;
          // Track active users per department
          if (userDept && departmentData[userDept]) {
            departmentData[userDept].activeUsers += 1;
          }
        }
      });
    }

    // Calculate averages
    const competencyAverages: Record<string, { averageScore: number; averageLevel: number; assessedCount: number }> = {};
    let totalAvgScore = 0;
    let competenciesWithData = 0;

    Object.entries(competencyTotals).forEach(([compId, data]) => {
      const avgScore = data.count > 0 ? Math.round(data.totalScore / data.count) : 0;
      const avgLevel = data.levels.length > 0
        ? Math.round(data.levels.reduce((a, b) => a + b, 0) / data.levels.length * 10) / 10
        : 0;

      competencyAverages[compId] = {
        averageScore: avgScore,
        averageLevel: avgLevel,
        assessedCount: data.count,
      };

      if (avgScore > 0) {
        totalAvgScore += avgScore;
        competenciesWithData += 1;
      }
    });

    const overallScore = competenciesWithData > 0
      ? Math.round(totalAvgScore / competenciesWithData)
      : 0;

    // Calculate department-level averages
    const departmentAnalytics: Record<string, {
      totalEmployees: number;
      overallScore: number;
      competencyScores: Record<string, { averageScore: number; averageLevel: number; assessedCount: number }>;
    }> = {};

    Object.entries(departmentData).forEach(([deptName, deptData]) => {
      const deptCompetencyAverages: Record<string, { averageScore: number; averageLevel: number; assessedCount: number }> = {};
      let deptTotalAvgScore = 0;
      let deptCompetenciesWithData = 0;

      Object.entries(deptData.competencyTotals).forEach(([compId, data]) => {
        const avgScore = data.count > 0 ? Math.round(data.totalScore / data.count) : 0;
        const avgLevel = data.levels.length > 0
          ? Math.round(data.levels.reduce((a, b) => a + b, 0) / data.levels.length * 10) / 10
          : 0;

        deptCompetencyAverages[compId] = {
          averageScore: avgScore,
          averageLevel: avgLevel,
          assessedCount: data.count,
        };

        if (avgScore > 0) {
          deptTotalAvgScore += avgScore;
          deptCompetenciesWithData += 1;
        }
      });

      const deptOverallScore = deptCompetenciesWithData > 0
        ? Math.round(deptTotalAvgScore / deptCompetenciesWithData)
        : 0;

      departmentAnalytics[deptName] = {
        totalEmployees: deptData.totalEmployees,
        overallScore: deptOverallScore,
        competencyScores: deptCompetencyAverages,
      };
    });

    // Get campaign completion stats
    const completedEnrollments = await db.collection("campaignEnrollments")
      .where("organizationId", "==", organizationId)
      .where("status", "==", "completed")
      .get();

    const inProgressEnrollments = await db.collection("campaignEnrollments")
      .where("organizationId", "==", organizationId)
      .where("status", "==", "in-progress")
      .get();

    const totalEnrollments = await db.collection("campaignEnrollments")
      .where("organizationId", "==", organizationId)
      .get();

    const completionRate = totalEnrollments.size > 0
      ? Math.round((completedEnrollments.size / totalEnrollments.size) * 100)
      : 0;

    // Get engagement rate (users who have logged in/completed something this month)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsersSnapshot = await db.collection("userStats")
      .where("__name__", "in", userIds.slice(0, 30)) // Sample for engagement
      .get();

    let engagedUsers = 0;
    activeUsersSnapshot.docs.forEach(doc => {
      const lastCompletion = doc.data().lastCompletionDate;
      if (lastCompletion) {
        const lastDate = new Date(lastCompletion);
        if (lastDate >= thirtyDaysAgo) {
          engagedUsers += 1;
        }
      }
    });

    const engagementRate = totalEmployees > 0
      ? Math.round((engagedUsers / Math.min(totalEmployees, 30)) * 100)
      : 0;

    // Store current analytics snapshot
    const today = new Date().toISOString().split('T')[0];
    const analyticsRef = db.collection(ORGANIZATION_ANALYTICS_COLLECTION).doc(organizationId);

    const analyticsData = {
      organizationId,
      updatedAt: FieldValue.serverTimestamp(),

      // Summary metrics
      totalEmployees,
      activeUsersLast30Days: totalActiveUsers,
      overallScore,
      completionRate,
      engagementRate,

      // Competency averages
      competencyScores: {
        'psychological-safety': {
          name: 'Psychological Safety',
          ...competencyAverages['psychological-safety'],
        },
        'prosocial-norms': {
          name: 'Prosocial Norms',
          ...competencyAverages['prosocial-norms'],
        },
        'collaboration': {
          name: 'Collaboration',
          ...competencyAverages['collaboration'],
        },
        'growth': {
          name: 'Growth',
          ...competencyAverages['growth'],
        },
      },

      // Campaign stats
      campaignStats: {
        completedCount: completedEnrollments.size,
        inProgressCount: inProgressEnrollments.size,
        totalEnrollments: totalEnrollments.size,
      },

      // Department-level analytics
      departmentAnalytics,
    };

    await analyticsRef.set(analyticsData, { merge: true });

    // Store daily history snapshot (for trend charts)
    // Build department history data (simplified for trend charts)
    const departmentHistoryData: Record<string, {
      overallScore: number;
      competencyScores: Record<string, number>;
      totalEmployees: number;
    }> = {};

    Object.entries(departmentAnalytics).forEach(([deptName, deptData]) => {
      departmentHistoryData[deptName] = {
        overallScore: deptData.overallScore,
        competencyScores: {
          'psychological-safety': deptData.competencyScores['psychological-safety']?.averageScore || 0,
          'prosocial-norms': deptData.competencyScores['prosocial-norms']?.averageScore || 0,
          'collaboration': deptData.competencyScores['collaboration']?.averageScore || 0,
          'growth': deptData.competencyScores['growth']?.averageScore || 0,
        },
        totalEmployees: deptData.totalEmployees,
      };
    });

    const historyRef = analyticsRef.collection("history").doc(today);
    await historyRef.set({
      date: today,
      overallScore,
      competencyScores: {
        'psychological-safety': competencyAverages['psychological-safety'].averageScore,
        'prosocial-norms': competencyAverages['prosocial-norms'].averageScore,
        'collaboration': competencyAverages['collaboration'].averageScore,
        'growth': competencyAverages['growth'].averageScore,
      },
      totalEmployees,
      completionRate,
      engagementRate,
      // Department-level history data
      departmentAnalytics: departmentHistoryData,
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info(`📊 Updated analytics for org ${organizationId}: score=${overallScore}, employees=${totalEmployees}, departments=${Object.keys(departmentAnalytics).length}`);
  } catch (error) {
    logger.error(`❌ Error calculating analytics for org ${organizationId}:`, error);
  }
}

/**
 * Callable function to manually trigger organization analytics refresh
 * Useful for testing or when you need immediate updates
 */
export const refreshOrgAnalyticsManual = onCall({
  cors: [/localhost/, /dicode-software\.web\.app$/, /dicode-client\.web\.app$/],
  region: 'us-central1'
}, async (request) => {
  const organizationId = request.data?.organizationId;

  if (!organizationId) {
    throw new HttpsError("invalid-argument", "Organization ID is required");
  }

  logger.info(`🔄 Manually refreshing analytics for org ${organizationId}`);

  try {
    await calculateOrganizationAnalytics(organizationId);

    // Fetch and return the updated analytics
    const analyticsDoc = await db.collection(ORGANIZATION_ANALYTICS_COLLECTION).doc(organizationId).get();

    return {
      success: true,
      analytics: analyticsDoc.exists ? analyticsDoc.data() : null,
    };
  } catch (error) {
    logger.error(`❌ Error refreshing analytics for ${organizationId}:`, error);
    throw new HttpsError("internal", "Failed to refresh organization analytics");
  }
});

/**
 * Get organization analytics history for trend charts
 */
export const getOrgAnalyticsHistory = onCall({
  cors: [/localhost/, /dicode-software\.web\.app$/, /dicode-client\.web\.app$/],
  region: 'us-central1'
}, async (request) => {
  const { organizationId, startDate, endDate } = request.data || {};

  if (!organizationId) {
    throw new HttpsError("invalid-argument", "Organization ID is required");
  }

  try {
    let query = db.collection(ORGANIZATION_ANALYTICS_COLLECTION)
      .doc(organizationId)
      .collection("history")
      .orderBy("date", "asc");

    if (startDate) {
      query = query.where("date", ">=", startDate);
    }
    if (endDate) {
      query = query.where("date", "<=", endDate);
    }

    const historySnapshot = await query.limit(365).get();

    const history = historySnapshot.docs.map(doc => doc.data());

    // Also get current analytics
    const currentDoc = await db.collection(ORGANIZATION_ANALYTICS_COLLECTION).doc(organizationId).get();

    return {
      success: true,
      current: currentDoc.exists ? currentDoc.data() : null,
      history,
    };
  } catch (error) {
    logger.error(`❌ Error fetching analytics history for ${organizationId}:`, error);
    throw new HttpsError("internal", "Failed to fetch organization analytics history");
  }
});

/**
 * Get campaign-specific analytics for time-series charts and response distributions
 * Returns enrollments over time, completions over time, weekly trends, skill assessments, video aggregates
 */
export const getCampaignAnalytics = onCall({
  cors: [/localhost/, /dicode-software\.web\.app$/, /dicode-client\.web\.app$/],
  region: 'us-central1'
}, async (request) => {
  const { campaignId, organizationId, departmentFilter, cohortFilter } = request.data || {};

  if (!campaignId || !organizationId) {
    throw new HttpsError("invalid-argument", "Campaign ID and Organization ID are required");
  }

  logger.info(`📊 Fetching campaign analytics for campaign ${campaignId}, org ${organizationId}`);

  try {
    // 1. Fetch campaign document to get video items
    const campaignDoc = await db.collection("campaigns").doc(campaignId).get();
    if (!campaignDoc.exists) {
      throw new HttpsError("not-found", "Campaign not found");
    }
    const campaignData = campaignDoc.data()!;

    // Fix: Campaign items are normalized in a separate collection, not embedded
    // const campaignItems = campaignData.items || [];
    const itemIds: string[] = campaignData.itemIds || [];
    let campaignItems: any[] = [];

    logger.info(`🔍 Campaign ${campaignId} has ${itemIds.length} itemIds:`, itemIds);

    if (itemIds.length > 0) {
      // Fetch all items in parallel
      const itemRefs = itemIds.map(id => db.collection("campaignItems").doc(id));
      const itemSnapshots = await db.getAll(...itemRefs);

      campaignItems = itemSnapshots
        .filter(snap => snap.exists)
        .map(snap => ({ id: snap.id, ...snap.data() }));

      logger.info(`🔍 Fetched ${campaignItems.length} valid items from campaignItems.`);
      if (campaignItems.length > 0) {
        logger.info(`🔍 Sample item:`, campaignItems[0]);
      }

      // Sort by order if available
      campaignItems.sort((a, b) => (a.order || 0) - (b.order || 0));
    } else {
      logger.warn(`⚠️ Campaign ${campaignId} has NO itemIds.`);
    }

    // 2. Fetch enrollments for this campaign + org
    const enrollmentsSnapshot = await db.collection("campaignEnrollments")
      .where("campaignId", "==", campaignId)
      .where("organizationId", "==", organizationId)
      .get();

    // 3. Fetch responses for this campaign + org
    const responsesSnapshot = await db.collection("campaignResponses")
      .where("campaignId", "==", campaignId)
      .where("organizationId", "==", organizationId)
      .get();

    // 4. If department/cohort filter provided, fetch users to filter
    let filteredUserIds: Set<string> | null = null;
    if (departmentFilter || cohortFilter) {
      const usersSnapshot = await db.collection("users")
        .where("organization", "==", organizationId)
        .get();

      filteredUserIds = new Set();
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const matchesDept = !departmentFilter || departmentFilter === 'all' || userData.department === departmentFilter;
        const matchesCohort = !cohortFilter || cohortFilter === 'all' ||
          (userData.cohortIds && userData.cohortIds.includes(cohortFilter));

        if (matchesDept && matchesCohort) {
          filteredUserIds.add(userDoc.id);
        }
      }
    }

    // Filter enrollments and responses if needed
    const enrollments = filteredUserIds
      ? enrollmentsSnapshot.docs.filter(doc => filteredUserIds!.has(doc.data().userId))
      : enrollmentsSnapshot.docs;

    const responses = filteredUserIds
      ? responsesSnapshot.docs.filter(doc => filteredUserIds!.has(doc.data().userId))
      : responsesSnapshot.docs;

    // 5. Fetch videos for campaign items
    const videoMap: Record<string, any> = {};
    for (const item of campaignItems) {
      if (item.videoId) {
        const videoDoc = await db.collection("videos").doc(item.videoId).get();
        if (videoDoc.exists) {
          videoMap[item.videoId] = { id: videoDoc.id, ...videoDoc.data() };
        }
      }
    }

    // 6. Compute enrollments over time (cumulative by enrolledAt)
    const enrollmentsByDate: Record<string, number> = {};
    enrollments.forEach(doc => {
      const data = doc.data();
      if (data.enrolledAt) {
        const date = data.enrolledAt.toDate().toISOString().split('T')[0];
        enrollmentsByDate[date] = (enrollmentsByDate[date] || 0) + 1;
      }
    });

    const enrollmentDates = Object.keys(enrollmentsByDate).sort();
    let enrollmentCumulative = 0;
    const enrollmentsOverTime = enrollmentDates.map(date => {
      enrollmentCumulative += enrollmentsByDate[date];
      return { date, daily: enrollmentsByDate[date], cumulative: enrollmentCumulative };
    });

    // 7. Compute completions over time (cumulative by completedAt)
    const completionsByDate: Record<string, number> = {};
    enrollments.forEach(doc => {
      const data = doc.data();
      if (data.status === 'completed' && data.completedAt) {
        const date = data.completedAt.toDate().toISOString().split('T')[0];
        completionsByDate[date] = (completionsByDate[date] || 0) + 1;
      }
    });

    const completionDates = Object.keys(completionsByDate).sort();
    let completionCumulative = 0;
    const completionsOverTime = completionDates.map(date => {
      completionCumulative += completionsByDate[date];
      return { date, daily: completionsByDate[date], cumulative: completionCumulative };
    });

    // 8. Compute weekly response trends (by answeredAt)
    const responsesByWeek: Record<string, number> = {};
    responses.forEach(doc => {
      const data = doc.data();
      if (data.answeredAt) {
        const answeredDate = data.answeredAt.toDate();
        const dayOfWeek = answeredDate.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(answeredDate);
        monday.setDate(answeredDate.getDate() + mondayOffset);
        const weekKey = monday.toISOString().split('T')[0];
        responsesByWeek[weekKey] = (responsesByWeek[weekKey] || 0) + 1;
      }
    });

    const weekKeys = Object.keys(responsesByWeek).sort();
    let weekCumulative = 0;
    const weeklyResponseTrends = weekKeys.map(week => {
      weekCumulative += responsesByWeek[week];
      return { week, responses: responsesByWeek[week], cumulative: weekCumulative };
    });

    // 9. Compute daily distribution (day of week from answeredAt)
    const dayDistribution = [0, 0, 0, 0, 0, 0, 0];
    responses.forEach(doc => {
      const data = doc.data();
      if (data.answeredAt) {
        const dayOfWeek = data.answeredAt.toDate().getDay();
        dayDistribution[dayOfWeek]++;
      }
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyDistribution = dayNames.map((day, i) => ({ day, count: dayDistribution[i] }));

    // 10. Compute summary stats
    const completed = enrollments.filter(doc => doc.data().status === 'completed').length;
    const inProgress = enrollments.filter(doc => doc.data().status === 'in-progress').length;
    const notStarted = enrollments.filter(doc => doc.data().status === 'not-started').length;
    const enrolled = enrollments.length;

    let totalProgress = 0;
    enrollments.forEach(doc => {
      const data = doc.data();
      const totalModules = data.totalModules || 0;
      const completedModules = data.completedModules || 0;
      if (totalModules > 0) {
        totalProgress += (completedModules / totalModules) * 100;
      }
    });
    const avgCompletion = enrolled > 0 ? Math.round(totalProgress / enrolled) : 0;

    // 11. Compute skill assessments aggregates
    const skillMap: Record<string, { skillId: string; skillName: string; total: number; count: number }> = {};
    responses.forEach(doc => {
      const data = doc.data();
      const metadata = data.metadata || {};
      if (metadata.skillId && typeof data.answer === 'number') {
        const skillId = metadata.skillId;
        const skillName = metadata.skillName || skillId;
        if (!skillMap[skillId]) {
          skillMap[skillId] = { skillId, skillName, total: 0, count: 0 };
        }
        // Convert 1-7 scale to percentage (1=0%, 7=100%)
        const percentage = Math.round(((data.answer - 1) / 6) * 100);
        skillMap[skillId].total += percentage;
        skillMap[skillId].count += 1;
      }
    });

    const skillAggregates = Object.values(skillMap).map(skill => ({
      skillId: skill.skillId,
      skillName: skill.skillName,
      avgScore: skill.count > 0 ? Math.round(skill.total / skill.count) : 0,
      count: skill.count
    }));

    // 12. Compute per-video response aggregates
    interface QuestionAggregate {
      question: any;
      responses: any[];
      distribution?: Record<number, number>;
      choiceDistribution?: Record<string, number>;
      avgScore?: number;
      benchmarkOptionId?: string;
    }

    interface VideoAggregate {
      videoId: string;
      videoTitle: string;
      questions: QuestionAggregate[];
    }

    const videoAggregates: VideoAggregate[] = [];

    for (const item of campaignItems) {
      const video = videoMap[item.videoId];
      if (!video) continue;

      const questions = video.questions || [];
      if (questions.length === 0) continue;

      const videoAgg: VideoAggregate = {
        videoId: video.id,
        videoTitle: video.title || 'Untitled Video',
        questions: []
      };

      // Group responses by question for this video
      const responsesByQuestion: Record<string, any[]> = {};
      responses.forEach(doc => {
        const data = doc.data();
        if (data.videoId === video.id && data.questionId) {
          if (!responsesByQuestion[data.questionId]) {
            responsesByQuestion[data.questionId] = [];
          }
          responsesByQuestion[data.questionId].push({ id: doc.id, ...data });
        }
      });

      // Process each question
      for (const question of questions) {
        const qResponses = responsesByQuestion[question.id] || [];
        const qAgg: QuestionAggregate = {
          question: {
            id: question.id,
            type: question.type,
            statement: question.statement,
            benchmarkScore: question.benchmarkScore,
            options: question.options,
            competency: question.competency,
            competencyId: question.competencyId,
            skillId: question.skillId
          },
          responses: qResponses.map(r => ({
            id: r.id,
            answer: r.answer,
            selectedOptionId: r.selectedOptionId,
            intentScore: r.intentScore
          }))
        };

        if (qResponses.length > 0) {
          if (question.type === 'behavioral-perception') {
            // Q1: Likert scale distribution (1-7)
            const numericResponses = qResponses
              .map(r => typeof r.answer === 'number' ? r.answer : parseFloat(r.answer))
              .filter(n => !isNaN(n));

            if (numericResponses.length > 0) {
              qAgg.avgScore = numericResponses.reduce((a, b) => a + b, 0) / numericResponses.length;
              qAgg.distribution = {};
              numericResponses.forEach(n => {
                const rounded = Math.round(n);
                qAgg.distribution![rounded] = (qAgg.distribution![rounded] || 0) + 1;
              });
            }
          } else if (question.type === 'behavioral-intent' && question.options) {
            // Q2: Multiple choice distribution by selectedOptionId
            qAgg.choiceDistribution = {};
            let totalIntentScore = 0;
            let intentCount = 0;

            qResponses.forEach(r => {
              if (r.selectedOptionId) {
                qAgg.choiceDistribution![r.selectedOptionId] =
                  (qAgg.choiceDistribution![r.selectedOptionId] || 0) + 1;
                if (r.intentScore !== undefined) {
                  totalIntentScore += r.intentScore;
                  intentCount++;
                }
              } else if (typeof r.answer === 'object' && r.answer?.selectedOptionId) {
                // Legacy format
                qAgg.choiceDistribution![r.answer.selectedOptionId] =
                  (qAgg.choiceDistribution![r.answer.selectedOptionId] || 0) + 1;
                if (r.answer.intentScore !== undefined) {
                  totalIntentScore += r.answer.intentScore;
                  intentCount++;
                }
              }
            });

            if (intentCount > 0) {
              qAgg.avgScore = Math.round((totalIntentScore / intentCount / 7) * 100);
            }

            // Find best answer (highest intentScore)
            if (question.options && question.options.length > 0) {
              const bestOption = question.options.reduce((best: any, opt: any) =>
                (opt.intentScore > (best?.intentScore || 0)) ? opt : best, question.options[0]);
              qAgg.benchmarkOptionId = bestOption?.id;
            }
          }
          // Q3 (qualitative) - just include responses, frontend handles word cloud
        }

        videoAgg.questions.push(qAgg);
      }

      if (videoAgg.questions.length > 0) {
        videoAggregates.push(videoAgg);
      }
    }

    logger.info(`📊 Campaign ${campaignId}: ${enrolled} enrolled, ${completed} completed, ${responses.length} responses, ${videoAggregates.length} videos`);

    return {
      enrollmentsOverTime,
      completionsOverTime,
      weeklyResponseTrends,
      dailyDistribution,
      stats: {
        enrolled,
        completed,
        inProgress,
        avgCompletion,
        totalResponses: responses.length
      },
      completionStatus: {
        completed,
        inProgress,
        notStarted
      },
      skillAggregates,
      videoAggregates
    };
  } catch (error) {
    logger.error(`❌ Error fetching campaign analytics for ${campaignId}:`, error);
    throw new HttpsError("internal", "Failed to fetch campaign analytics");
  }
});
