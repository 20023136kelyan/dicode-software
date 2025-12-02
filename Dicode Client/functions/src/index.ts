/**
 * Firebase Cloud Functions for DiCode Campaign Management
 *
 * These functions handle:
 * - Auto-enrollment when campaigns are published
 * - Scheduled reminder emails
 * - Notification queue processing
 * - Automatic completion detection
 * - Recurring campaign automation
 *
 * Environment Variables Required:
 * - SENDGRID_API_KEY: SendGrid API key for sending emails
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { randomBytes } from 'crypto';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';
const FROM_EMAIL = 'noreply@dicode.com';
const FROM_NAME = 'DiCode';

// ============================================
// EMAIL SENDING UTILITIES
// ============================================

interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: EmailParams): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.warn('⚠️ SendGrid API key not configured. Email not sent:', { to, subject });
    return;
  }

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
    }

    console.log('✅ Email sent successfully:', { to, subject });
  } catch (error) {
    console.error('❌ Failed to send email:', error);
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

// ============================================
// CLOUD FUNCTION: Auto-Enroll on Campaign Publish
// ============================================

/**
 * Triggered when a campaign's isPublished status changes to true
 * Auto-enrolls all targeted participants and queues invitation emails
 */
export const onCampaignPublished = functions.firestore
  .document('campaigns/{campaignId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const campaignId = context.params.campaignId;

    // Check if campaign was just published
    if (!before.metadata?.isPublished && after.metadata?.isPublished) {
      console.log(`📢 Campaign published: ${campaignId}`);

      try {
        const campaign = after;
        const organizationId = campaign.allowedOrganizations?.[0];

        if (!organizationId) {
          console.log('⚠️ No organization specified for campaign');
          return;
        }

        // Get all users in the organization
        const usersSnapshot = await db
          .collection('users')
          .where('organization', '==', organizationId)
          .get();

        const enrollmentPromises: Promise<any>[] = [];
        const notificationPromises: Promise<any>[] = [];

        for (const userDoc of usersSnapshot.docs) {
          const userId = userDoc.id;
          const userData = userDoc.data();

          // Check if user matches campaign filters
          const matchesFilters = checkUserMatchesCampaignFilters(
            campaign,
            userData
          );

          if (matchesFilters) {
            // Check if already enrolled
            const existingEnrollment = await db
              .collection('campaignEnrollments')
              .where('campaignId', '==', campaignId)
              .where('userId', '==', userId)
              .get();

            if (existingEnrollment.empty) {
              // Create enrollment
              enrollmentPromises.push(
                db.collection('campaignEnrollments').add({
                  campaignId,
                  userId,
                  organizationId,
                  status: 'not-started',
                  enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
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
                  db.collection('campaignNotifications').add({
                    campaignId,
                    userId,
                    organizationId,
                    type: 'invitation',
                    status: 'pending',
                    recipientEmail: userData.email,
                    scheduledFor: admin.firestore.FieldValue.serverTimestamp(),
                    retryCount: 0,
                    metadata: {
                      campaignTitle: campaign.title,
                      userName: userData.name || userData.email,
                    },
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  })
                );
              }
            }
          }
        }

        await Promise.all([...enrollmentPromises, ...notificationPromises]);
        console.log(`✅ Auto-enrolled ${enrollmentPromises.length} users in campaign ${campaignId}`);

        // Update campaign stats
        await change.after.ref.update({
          'stats.totalEnrollments': enrollmentPromises.length,
          'stats.notStartedCount': enrollmentPromises.length,
          'stats.inProgressCount': 0,
          'stats.completedCount': 0,
        });

      } catch (error) {
        console.error('❌ Error auto-enrolling users:', error);
      }
    }
  });

/**
 * Helper function to check if user matches campaign filters
 */
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

// ============================================
// CLOUD FUNCTION: Send Scheduled Reminders
// ============================================

/**
 * Runs daily at 9 AM to send reminder emails to users with incomplete campaigns
 */
export const sendScheduledReminders = functions.pubsub
  .schedule('0 9 * * *') // Every day at 9 AM
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log('⏰ Running scheduled reminder job...');

    try {
      // Get all published campaigns with reminders enabled
      const campaignsSnapshot = await db
        .collection('campaigns')
        .where('metadata.isPublished', '==', true)
        .where('automation.sendReminders', '==', true)
        .get();

      const notificationPromises: Promise<any>[] = [];

      for (const campaignDoc of campaignsSnapshot.docs) {
        const campaign = campaignDoc.data();
        const campaignId = campaignDoc.id;

        // Get enrollments that are in-progress (not completed)
        const enrollmentsSnapshot = await db
          .collection('campaignEnrollments')
          .where('campaignId', '==', campaignId)
          .where('status', 'in', ['not-started', 'in-progress'])
          .get();

        for (const enrollmentDoc of enrollmentsSnapshot.docs) {
          const enrollment = enrollmentDoc.data();
          const userId = enrollment.userId;

          // Check if user has exceeded max reminders
          const reminderCount = await getNotificationCount(
            campaignId,
            userId,
            'reminder'
          );

          const maxReminders = campaign.automation?.maxReminders || 3;
          if (reminderCount >= maxReminders) {
            continue; // Skip if max reminders reached
          }

          // Check if enough time has passed since last reminder
          const lastReminder = await getLastNotification(
            campaignId,
            userId,
            'reminder'
          );

          const reminderFrequency = campaign.automation?.reminderFrequency || 3; // days
          const daysSinceLastReminder = lastReminder
            ? (Date.now() - lastReminder.createdAt.toMillis()) / (1000 * 60 * 60 * 24)
            : reminderFrequency + 1;

          if (daysSinceLastReminder >= reminderFrequency) {
            // Get user data
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();

            if (userData) {
              // Queue reminder notification
              notificationPromises.push(
                db.collection('campaignNotifications').add({
                  campaignId,
                  userId,
                  organizationId: enrollment.organizationId,
                  type: 'reminder',
                  status: 'pending',
                  recipientEmail: userData.email,
                  scheduledFor: admin.firestore.FieldValue.serverTimestamp(),
                  retryCount: 0,
                  metadata: {
                    campaignTitle: campaign.title,
                    userName: userData.name || userData.email,
                  },
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                })
              );
            }
          }
        }
      }

      await Promise.all(notificationPromises);
      console.log(`✅ Queued ${notificationPromises.length} reminder notifications`);

    } catch (error) {
      console.error('❌ Error sending scheduled reminders:', error);
    }
  });

/**
 * Helper: Get count of notifications sent to a user for a campaign
 */
async function getNotificationCount(
  campaignId: string,
  userId: string,
  type: string
): Promise<number> {
  const snapshot = await db
    .collection('campaignNotifications')
    .where('campaignId', '==', campaignId)
    .where('userId', '==', userId)
    .where('type', '==', type)
    .where('status', '==', 'sent')
    .get();

  return snapshot.size;
}

/**
 * Helper: Get last notification sent to a user for a campaign
 */
async function getLastNotification(
  campaignId: string,
  userId: string,
  type: string
): Promise<any> {
  const snapshot = await db
    .collection('campaignNotifications')
    .where('campaignId', '==', campaignId)
    .where('userId', '==', userId)
    .where('type', '==', type)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0].data();
}

// ============================================
// CLOUD FUNCTION: Process Notification Queue
// ============================================

/**
 * Runs every 5 minutes to process pending email notifications
 */
export const processNotificationQueue = functions.pubsub
  .schedule('*/5 * * * *') // Every 5 minutes
  .onRun(async (context) => {
    console.log('📧 Processing notification queue...');

    try {
      // Get pending notifications scheduled for now or earlier
      const notificationsSnapshot = await db
        .collection('campaignNotifications')
        .where('status', '==', 'pending')
        .where('scheduledFor', '<=', admin.firestore.FieldValue.serverTimestamp())
        .limit(100) // Process in batches
        .get();

      console.log(`Found ${notificationsSnapshot.size} pending notifications`);

      for (const notificationDoc of notificationsSnapshot.docs) {
        const notification = notificationDoc.data();
        const notificationId = notificationDoc.id;

        try {
          // Get campaign data for email content
          const campaignDoc = await db.collection('campaigns').doc(notification.campaignId).get();
          const campaign = campaignDoc.data();

          if (!campaign) {
            throw new Error('Campaign not found');
          }

          const campaignUrl = `https://your-app-url.com/campaigns/${notification.campaignId}`;

          // Send appropriate email based on type
          if (notification.type === 'invitation') {
            await sendEmail({
              to: notification.recipientEmail,
              subject: `New Learning Campaign: ${campaign.title}`,
              html: generateEmailTemplate(`
                <h2>You've been invited to a new learning campaign!</h2>
                <p>Hi ${notification.metadata?.userName || 'there'},</p>
                <p>Your organization has enrolled you in: <strong>${campaign.title}</strong></p>
                <a href="${campaignUrl}" class="button">Start Campaign</a>
              `),
            });
          } else if (notification.type === 'reminder') {
            await sendEmail({
              to: notification.recipientEmail,
              subject: `Reminder: ${campaign.title}`,
              html: generateEmailTemplate(`
                <h2>Reminder: Complete your learning campaign</h2>
                <p>Hi ${notification.metadata?.userName || 'there'},</p>
                <p>You have an incomplete campaign: <strong>${campaign.title}</strong></p>
                <a href="${campaignUrl}" class="button">Continue Campaign</a>
              `),
            });
          } else if (notification.type === 'completion') {
            await sendEmail({
              to: notification.recipientEmail,
              subject: `Campaign Completed: ${campaign.title}`,
              html: generateEmailTemplate(`
                <h2>🎉 Congratulations! Campaign Completed</h2>
                <p>Hi ${notification.metadata?.userName || 'there'},</p>
                <p>You've completed: <strong>${campaign.title}</strong></p>
                <p>Keep up the great work!</p>
              `),
            });
          }

          // Mark as sent
          await notificationDoc.ref.update({
            status: 'sent',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(`✅ Sent ${notification.type} notification to ${notification.recipientEmail}`);

        } catch (error) {
          console.error(`❌ Failed to send notification ${notificationId}:`, error);

          // Mark as failed and increment retry count
          const retryCount = (notification.retryCount || 0) + 1;
          await notificationDoc.ref.update({
            status: 'failed',
            failureReason: String(error),
            retryCount,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

    } catch (error) {
      console.error('❌ Error processing notification queue:', error);
    }
  });

// ============================================
// CLOUD FUNCTION: Auto-Detect Completion
// ============================================

/**
 * Triggered when campaign progress is updated
 * Checks if user has completed all videos/questions and triggers completion email
 */
export const onProgressUpdated = functions.firestore
  .document('campaignProgress/{progressId}')
  .onWrite(async (change, context) => {
    // Only proceed if document was created or updated (not deleted)
    if (!change.after.exists) {
      return;
    }

    const progress = change.after.data()!;
    const campaignId = progress.campaignId;
    const userId = progress.userId;

    try {
      // Get all progress for this user in this campaign
      const allProgressSnapshot = await db
        .collection('campaignProgress')
        .where('campaignId', '==', campaignId)
        .where('userId', '==', userId)
        .get();

      // Get campaign to know total videos
      const campaignDoc = await db.collection('campaigns').doc(campaignId).get();
      const campaign = campaignDoc.data();

      if (!campaign) {
        return;
      }

      const totalVideos = campaign.itemIds?.length || 0;
      const completedVideos = allProgressSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.completed && data.allQuestionsAnswered;
      }).length;

      // Check if campaign is complete
      if (completedVideos >= totalVideos && totalVideos > 0) {
        console.log(`🎉 User ${userId} completed campaign ${campaignId}`);

        // Check if already marked as completed
        const enrollmentSnapshot = await db
          .collection('campaignEnrollments')
          .where('campaignId', '==', campaignId)
          .where('userId', '==', userId)
          .get();

        if (!enrollmentSnapshot.empty) {
          const enrollmentDoc = enrollmentSnapshot.docs[0];
          const enrollment = enrollmentDoc.data();

          if (enrollment.status !== 'completed') {
            // Mark enrollment as completed
            await enrollmentDoc.ref.update({
              status: 'completed',
              completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            await campaignDoc.ref.update({
              'stats.completedCount': admin.firestore.FieldValue.increment(1),
              'stats.inProgressCount': admin.firestore.FieldValue.increment(-1),
            });

            // Queue completion notification if enabled
            if (campaign.automation?.sendConfirmations) {
              const userDoc = await db.collection('users').doc(userId).get();
              const userData = userDoc.data();

              if (userData) {
                await db.collection('campaignNotifications').add({
                  campaignId,
                  userId,
                  organizationId: enrollment.organizationId,
                  type: 'completion',
                  status: 'pending',
                  recipientEmail: userData.email,
                  scheduledFor: admin.firestore.FieldValue.serverTimestamp(),
                  retryCount: 0,
                  metadata: {
                    campaignTitle: campaign.title,
                    userName: userData.name || userData.email,
                  },
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('❌ Error checking campaign completion:', error);
    }
  });

// ============================================
// CLOUD FUNCTION: Process Recurring Campaigns
// ============================================

/**
 * Runs daily at midnight to create new instances of recurring campaigns
 */
export const processRecurringCampaigns = functions.pubsub
  .schedule('0 0 * * *') // Every day at midnight
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log('🔄 Processing recurring campaigns...');

    try {
      // Get all published campaigns with recurring frequency
      const campaignsSnapshot = await db
        .collection('campaigns')
        .where('metadata.isPublished', '==', true)
        .get();

      for (const campaignDoc of campaignsSnapshot.docs) {
        const campaign = campaignDoc.data();
        const campaignId = campaignDoc.id;

        // Skip if not recurring
        if (campaign.schedule?.frequency === 'once') {
          continue;
        }

        const frequency = campaign.schedule?.frequency;
        const startDate = campaign.schedule?.startDate;

        if (!frequency || !startDate) {
          continue;
        }

        // Get existing instances to determine next instance number
        const instancesSnapshot = await db
          .collection('campaignInstances')
          .where('parentCampaignId', '==', campaignId)
          .orderBy('instanceNumber', 'desc')
          .limit(1)
          .get();

        const lastInstanceNumber = instancesSnapshot.empty
          ? 0
          : instancesSnapshot.docs[0].data().instanceNumber;

        const nextInstanceNumber = lastInstanceNumber + 1;

        // Calculate next instance dates based on frequency
        const now = new Date();
        const startDateTime = typeof startDate === 'string'
          ? new Date(startDate)
          : startDate.toDate ? startDate.toDate()
            : new Date(startDate);

        let shouldCreateInstance = false;
        let instanceStartDate = new Date(startDateTime);
        let instanceEndDate = new Date(startDateTime);

        if (frequency === 'weekly') {
          instanceStartDate.setDate(instanceStartDate.getDate() + (nextInstanceNumber - 1) * 7);
          instanceEndDate.setDate(instanceStartDate.getDate() + 7);
          shouldCreateInstance = now >= instanceStartDate && now < instanceEndDate;
        } else if (frequency === 'monthly') {
          instanceStartDate.setMonth(instanceStartDate.getMonth() + (nextInstanceNumber - 1));
          instanceEndDate.setMonth(instanceStartDate.getMonth() + 1);
          shouldCreateInstance = now >= instanceStartDate && now < instanceEndDate;
        } else if (frequency === 'quarterly') {
          instanceStartDate.setMonth(instanceStartDate.getMonth() + (nextInstanceNumber - 1) * 3);
          instanceEndDate.setMonth(instanceStartDate.getMonth() + 3);
          shouldCreateInstance = now >= instanceStartDate && now < instanceEndDate;
        }

        if (shouldCreateInstance) {
          // Create new campaign instance
          await db.collection('campaignInstances').add({
            parentCampaignId: campaignId,
            organizationId: campaign.allowedOrganizations?.[0],
            instanceNumber: nextInstanceNumber,
            startDate: admin.firestore.Timestamp.fromDate(instanceStartDate),
            endDate: admin.firestore.Timestamp.fromDate(instanceEndDate),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            stats: {
              totalEnrollments: 0,
              completedCount: 0,
              inProgressCount: 0,
              notStartedCount: 0,
            },
          });

          console.log(`✅ Created instance ${nextInstanceNumber} for campaign ${campaignId}`);
        }
      }

    } catch (error) {
      console.error('❌ Error processing recurring campaigns:', error);
    }
  });

// ============================================
// CLOUD FUNCTION: AI Copilot (RAG)
// ============================================
export { askCompanyBot } from './askCompanyBot';

// ============================================
// CLOUD FUNCTION: Create Employee Account
// ============================================

/**
 * Cloud Function to create employee Firebase Auth accounts and Firestore user documents
 * This prevents the client-side auth state from being affected and bypasses Firestore security rules
 * Also generates a password reset link for the employee to set their own password
 */
export const createEmployeeAccount = onCall(
  {
    cors: true,
  },
  async (request) => {
    try {
      const { email, role, name, organization, department } = request.data;

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      if (!role || !name || !organization) {
        throw new HttpsError('invalid-argument', 'Role, name, and organization are required');
      }

      console.log(`[createEmployeeAccount] Creating account for: ${email}`);

      // Generate a secure random password (user will never see this)
      const randomPassword = randomBytes(32).toString('hex');

      // Step 1: Create Firebase Auth account (doesn't affect client auth state)
      const userRecord = await admin.auth().createUser({
        email: email.toLowerCase(),
        password: randomPassword,
        emailVerified: false,
      });

      console.log(`✅ Firebase Auth account created: ${userRecord.uid}`);

      // Step 2: Generate password reset link
      const appUrl = process.env.APP_URL || 'https://dicode-workspace.web.app';

      // Generate Firebase password reset link
      const firebaseResetLink = await admin.auth().generatePasswordResetLink(
        email.toLowerCase(),
        {
          url: `${appUrl}/login`, // Where to go AFTER password is set
        }
      );

      // Extract oobCode from Firebase link to create our custom link
      const url = new URL(firebaseResetLink);
      const oobCode = url.searchParams.get('oobCode');

      if (!oobCode) {
        throw new HttpsError('internal', 'Failed to extract oobCode from password reset link');
      }

      // Create direct link to our custom password reset page
      const passwordResetLink = `${appUrl}/reset-password?oobCode=${oobCode}`;

      console.log(`✅ Password reset link generated for: ${email}`);

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
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection('users').doc(userRecord.uid).set(userDoc);

      console.log(`✅ Firestore user document created: ${userRecord.uid}`);

      return {
        success: true,
        userId: userRecord.uid,
        passwordResetLink,
        message: `Account created for ${email}`,
      };
    } catch (error: any) {
      console.error('❌ Error creating employee account:', error);

      // Handle specific Firebase Auth errors
      if (error.code === 'auth/email-already-exists') {
        throw new HttpsError(
          'already-exists',
          'An account with this email already exists'
        );
      }

      if (error.code === 'auth/invalid-email') {
        throw new HttpsError('invalid-argument', 'Invalid email address');
      }

      throw new HttpsError(
        'internal',
        error.message || 'Failed to create employee account'
      );
    }
  }
);
