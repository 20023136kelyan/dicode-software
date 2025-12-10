
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import * as logger from "firebase-functions/logger";

// Lazy initialization to avoid calling getFirestore() before initializeApp()
let _db: FirebaseFirestore.Firestore | null = null;
function getDb() {
    if (!_db) {
        if (!getApps().length) {
            initializeApp();
        }
        _db = getFirestore();
    }
    return _db;
}

const ORGANIZATION_NOTIFICATIONS_COLLECTION = "organizationNotifications";

export type AdminNotificationType =
    | 'system_alert'
    | 'user_joined'
    | 'campaign_status'
    | 'license_limit'
    | 'organization_update';

export interface CreateAdminNotificationParams {
    organizationId: string;
    type: AdminNotificationType;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, any>;
}

/**
 * Create an organization-wide notification (visible to admins)
 */
export async function createOrganizationNotification(params: CreateAdminNotificationParams): Promise<string> {
    try {
        const notificationData = {
            organizationId: params.organizationId,
            type: params.type,
            title: params.title,
            message: params.message,
            link: params.link || null,
            metadata: params.metadata || {},
            read: false,
            createdAt: FieldValue.serverTimestamp(),
        };

        const docRef = await getDb().collection(ORGANIZATION_NOTIFICATIONS_COLLECTION).add(notificationData);
        logger.info(`📢 Created admin notification for org ${params.organizationId}: ${params.title}`);
        return docRef.id;
    } catch (error) {
        logger.error("Error creating admin notification:", error);
        throw error;
    }
}
