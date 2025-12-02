import { Buffer } from "node:buffer";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { onRequest, onCall, HttpsError, type Request as FunctionsRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import type { Response as FunctionsResponse } from "express";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import OpenAI from 'openai';

import { POST as generateVideoPost } from "@/app/api/generate-video/route";
import { POST as mergeVideosPost } from "@/app/api/merge-videos/route";
// import { POST as extractFramePost } from "@/app/api/extract-frame/route"; // Removed as it doesn't exist
import { POST as remixVideoPost } from "@/app/api/remix-video/route";
import { POST as generateImagesPost } from "@/app/api/generate-images/route";
import { POST as suggestPromptPost } from "@/app/api/suggest-prompt/route";
import { POST as questionToolsPost } from "@/app/api/question-tools/route";
import { POST as videoTitlePost } from "@/app/api/video-title/route";
import { GET as videoGet } from "@/app/api/videos/[id]/route";
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

    const match = findRoute(req.method ?? "GET", path);
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

function generateEmailTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 30px 40px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px; }
        .button { display: inline-block; padding: 14px 32px; margin: 20px 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; }
        .footer { padding: 30px 40px; background-color: #f8f9fa; text-align: center; color: #6c757d; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>DiCode</h1></div>
        <div class="content">${content}</div>
        <div class="footer"><p>This is an automated message from DiCode.</p></div>
      </div>
    </body>
    </html>
  `;
}

// Helper function to check if user matches campaign filters
function checkUserMatchesCampaignFilters(campaign: any, user: any): boolean {
  const { allowedDepartments, allowedEmployeeIds, allowedCohortIds } = campaign;

  // If no granular filters, all users in organization match
  const hasGranularFilters =
    (allowedDepartments && allowedDepartments.length > 0) ||
    (allowedEmployeeIds && allowedEmployeeIds.length > 0) ||
    (allowedCohortIds && allowedCohortIds.length > 0);

  if (!hasGranularFilters) {
    return true;
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

        // Update campaign stats
        await event.data?.after.ref.update({
          "stats.totalEnrollments": enrollmentPromises.length,
          "stats.notStartedCount": enrollmentPromises.length,
          "stats.inProgressCount": 0,
          "stats.completedCount": 0,
        });
      } catch (error) {
        logger.error("❌ Error auto-enrolling users", error);
      }
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

          // Use APP_URL for campaign links (DiCode client)
          const appUrl = process.env.APP_URL || "https://dicode-2.web.app";
          const campaignUrl = `${appUrl}/campaigns/${notification.campaignId}`;

          // Send appropriate email based on type
          if (notification.type === "invitation") {
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
          This invitation expires on ${expiryDate}.
        </p>
        <p style="margin-top: 20px; color: #6c757d; font-size: 14px;">
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
      const appUrl = process.env.APP_URL || "https://dicode-workspace.web.app";

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
