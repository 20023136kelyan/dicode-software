
import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    updateDoc,
    doc,
    writeBatch,
    getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminNotification } from '@/types';

// Cache for campaign names to avoid repeated fetches
const campaignNameCache: Record<string, string> = {};

export function useAdminNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<AdminNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Fetch campaign name by ID with caching
    const getCampaignName = useCallback(async (campaignId: string): Promise<string | null> => {
        if (campaignNameCache[campaignId]) {
            return campaignNameCache[campaignId];
        }

        try {
            const campaignDoc = await getDoc(doc(db, 'campaigns', campaignId));
            if (campaignDoc.exists()) {
                const name = campaignDoc.data().title || campaignDoc.data().name;
                if (name) {
                    campaignNameCache[campaignId] = name;
                    return name;
                }
            }
        } catch (err) {
            console.warn('Failed to fetch campaign name:', campaignId, err);
        }
        return null;
    }, []);

    // Replace campaign IDs with names in message text
    const resolveCampaignNames = useCallback(async (msgs: AdminNotification[]): Promise<AdminNotification[]> => {
        // Extract unique campaign IDs from metadata and messages
        const campaignIds = new Set<string>();

        msgs.forEach(msg => {
            // Check metadata for campaignId
            if (msg.metadata?.campaignId) {
                campaignIds.add(msg.metadata.campaignId);
            }
            // Look for campaign IDs in message (pattern: campaign ID or "campaign: <id>")
            const idMatches = msg.message?.match(/campaign[:\s]+([a-zA-Z0-9]{20,})/gi);
            if (idMatches) {
                idMatches.forEach(match => {
                    const id = match.replace(/campaign[:\s]+/i, '');
                    if (id.length >= 20) campaignIds.add(id);
                });
            }
        });

        // Fetch all campaign names in parallel
        const namePromises = Array.from(campaignIds).map(async id => ({
            id,
            name: await getCampaignName(id)
        }));
        const results = await Promise.all(namePromises);
        const idToName: Record<string, string> = {};
        results.forEach(r => {
            if (r.name) idToName[r.id] = r.name;
        });

        // Replace IDs with names in messages
        return msgs.map(msg => {
            let updatedMessage = msg.message;
            let updatedTitle = msg.title;

            // Replace from metadata first
            if (msg.metadata?.campaignId && idToName[msg.metadata.campaignId]) {
                const name = idToName[msg.metadata.campaignId];
                updatedMessage = updatedMessage?.replace(msg.metadata.campaignId, `"${name}"`);
                updatedTitle = updatedTitle?.replace(msg.metadata.campaignId, `"${name}"`);
            }

            // Replace any other campaign IDs found in text
            Object.entries(idToName).forEach(([id, name]) => {
                if (updatedMessage?.includes(id)) {
                    updatedMessage = updatedMessage.replace(new RegExp(id, 'g'), `"${name}"`);
                }
                if (updatedTitle?.includes(id)) {
                    updatedTitle = updatedTitle.replace(new RegExp(id, 'g'), `"${name}"`);
                }
            });

            return { ...msg, message: updatedMessage, title: updatedTitle };
        });
    }, [getCampaignName]);

    useEffect(() => {
        if (!user?.organization) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'organizationNotifications'),
            where('organizationId', '==', user.organization),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const msgs: AdminNotification[] = [];
            let unread = 0;

            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data() as Omit<AdminNotification, 'id'>;
                if (!data.read) unread++;
                msgs.push({ id: docSnap.id, ...data });
            });

            // Resolve campaign names before setting state
            const resolvedMsgs = await resolveCampaignNames(msgs);

            setNotifications(resolvedMsgs);
            setUnreadCount(unread);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching admin notifications:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.organization, resolveCampaignNames]);

    const markAsRead = async (id: string) => {
        try {
            const notifRef = doc(db, 'organizationNotifications', id);
            await updateDoc(notifRef, { read: true });
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const batch = writeBatch(db);
            const unreadNotifications = notifications.filter(n => !n.read);

            if (unreadNotifications.length === 0) return;

            unreadNotifications.forEach(n => {
                const ref = doc(db, 'organizationNotifications', n.id);
                batch.update(ref, { read: true });
            });

            await batch.commit();
        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    };

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead
    };
}
