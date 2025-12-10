
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getApps, initializeApp } from "firebase-admin/app";
import * as logger from "firebase-functions/logger";
import { createOrganizationNotification } from "@/lib/admin-notifications";

if (getApps().length === 0) {
    initializeApp();
}

const db = getFirestore();
const auth = getAuth();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { organizationId, departments, action, targetDepartment } = body;

        if (!organizationId || !departments || !Array.isArray(departments) || departments.length === 0) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
        }

        if (action === 'reassign' && !targetDepartment) {
            return new Response(JSON.stringify({ error: "Target department is required for reassignment" }), { status: 400 });
        }

        logger.info(`Processing department deletion for org ${organizationId}`, { departments, action });

        // 1. Find all affected users
        const usersSnapshot = await db.collection("users")
            .where("organization", "==", organizationId)
            .where("department", "in", departments)
            .get();

        const affectedUserIds = usersSnapshot.docs.map(doc => doc.id);
        let processedCount = 0;

        // 2. Perform Action on Users
        if (affectedUserIds.length > 0) {
            if (action === 'reassign') {
                const batch = db.batch();
                usersSnapshot.docs.forEach(doc => {
                    batch.update(doc.ref, { department: targetDepartment });
                });
                await batch.commit();
                processedCount = affectedUserIds.length;
                logger.info(`Reassigned ${processedCount} users to ${targetDepartment}`);
            }
            else if (action === 'delete_users') {
                // Delete from Auth
                const deleteAuthPromises = affectedUserIds.map(uid => auth.deleteUser(uid).catch(err => {
                    logger.error(`Failed to delete auth user ${uid}`, err);
                    return null;
                }));
                await Promise.all(deleteAuthPromises);

                // Delete from Firestore (Batch)
                const batch = db.batch();
                usersSnapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();

                processedCount = affectedUserIds.length;
                logger.info(`Deleted ${processedCount} users`);
            }
        }

        // 3. Update Organization (Remove departments)
        const orgRef = db.collection("organizations").doc(organizationId);
        await orgRef.update({
            departments: FieldValue.arrayRemove(...departments)
        });

        // Notify Admins
        await createOrganizationNotification({
            organizationId,
            type: 'organization_update',
            title: 'Departments Deleted',
            message: `${departments.length} department(s) were deleted: ${departments.join(', ')}. Action taken on users: ${action === 'reassign' ? `Reassigned to ${targetDepartment}` : 'Deleted accounts'}.`,
            metadata: { departments, action, targetDepartment, affectedCount: processedCount }
        });

        return new Response(JSON.stringify({
            success: true,
            processedCount,
            message: `Successfully deleted ${departments.length} departments and processed ${processedCount} users.`
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        logger.error("Error deleting departments", error);
        return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), { status: 500 });
    }
}
