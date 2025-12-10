import { useEffect, useState, useRef } from 'react';
import { onSnapshot, doc, query, where, collection, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  CAMPAIGN_ENROLLMENTS_COLLECTION,
  CAMPAIGN_RESPONSES_COLLECTION,
  buildEnrollmentFromData,
  checkUserEnrollment,
  enrollUserInCampaign,
} from '@/lib/firestore';
import type { CampaignEnrollment, CampaignResponse } from '@/types';

/**
 * Real-time hook for a single enrollment document
 * Updates automatically when enrollment changes (including moduleProgress)
 *
 * Uses a query-based listener to automatically detect enrollments created externally.
 * This ensures that if enrollment is created by load logic or other code paths,
 * the hook will automatically pick it up without needing a manual refresh.
 *
 * @param campaignId - The campaign ID
 * @param userId - The user ID
 * @param skipAutoEnroll - If true, don't auto-create enrollment (used for DiCode campaigns)
 */
export function useEnrollmentRealtime(
  campaignId: string,
  userId: string,
  skipAutoEnroll: boolean = false
): { enrollment: CampaignEnrollment | null; isLoading: boolean; error: Error | null } {
  const [enrollment, setEnrollment] = useState<CampaignEnrollment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasTriedAutoEnrollRef = useRef(false);

  useEffect(() => {
    if (!campaignId || !userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    hasTriedAutoEnrollRef.current = false;

    // Use a query-based listener to automatically detect enrollments
    // This ensures we pick up enrollments created externally (e.g., by load logic)
    const q = query(
      collection(db, CAMPAIGN_ENROLLMENTS_COLLECTION),
      where('campaignId', '==', campaignId),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (!snapshot.empty) {
          // Found enrollment - use the first one (should only be one)
          const enrollmentDoc = snapshot.docs[0];
          const enrollmentData = buildEnrollmentFromData(enrollmentDoc.id, enrollmentDoc.data());
          console.log('[useEnrollmentRealtime] Found enrollment:', enrollmentData.id, 'status:', enrollmentData.status);
          setEnrollment(enrollmentData);
          setError(null);
          setIsLoading(false);
        } else {
          // No enrollment found
          console.log('[useEnrollmentRealtime] No enrollment found for campaign:', campaignId, 'skipAutoEnroll:', skipAutoEnroll);

          if (skipAutoEnroll) {
            // DiCode campaigns: don't auto-enroll, let the query listener wait for external creation
            setEnrollment(null);
            setIsLoading(false);
          } else if (!hasTriedAutoEnrollRef.current) {
            // Org campaigns: auto-create enrollment (only try once)
            hasTriedAutoEnrollRef.current = true;
            try {
              console.log('[useEnrollmentRealtime] Auto-enrolling user...');
              await enrollUserInCampaign(campaignId, userId, '', 'system', true);
              // Query listener will automatically pick up the new enrollment
            } catch (err) {
              console.error('Failed to create enrollment:', err);
              setError(err as Error);
              setIsLoading(false);
            }
          } else {
            // Already tried auto-enroll but still no enrollment
            setEnrollment(null);
            setIsLoading(false);
          }
        }
      },
      (err) => {
        console.error('Error listening to enrollment:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [campaignId, userId, skipAutoEnroll]);

  return { enrollment, isLoading, error };
}

/**
 * Real-time hook for user responses in a campaign
 * Returns a map of questionId -> answer for easy lookup
 */
export function useCampaignResponsesRealtime(
  campaignId: string,
  userId: string
): { responses: Record<string, CampaignResponse>; isLoading: boolean; error: Error | null } {
  const [responses, setResponses] = useState<Record<string, CampaignResponse>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!campaignId || !userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const q = query(
      collection(db, CAMPAIGN_RESPONSES_COLLECTION),
      where('campaignId', '==', campaignId),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const responsesMap: Record<string, CampaignResponse> = {};

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const response: CampaignResponse = {
            id: docSnap.id,
            campaignId: data.campaignId,
            videoId: data.videoId,
            questionId: data.questionId,
            userId: data.userId,
            organizationId: data.organizationId,
            answer: data.answer,
            answeredAt: data.answeredAt?.toDate ? data.answeredAt.toDate() : new Date(data.answeredAt),
            metadata: data.metadata,
          };
          // Map by videoId_questionId for unique lookup (questions may have same IDs across videos)
          const compositeKey = `${data.videoId}_${data.questionId}`;
          responsesMap[compositeKey] = response;
        });

        setResponses(responsesMap);
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error listening to responses:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [campaignId, userId]);

  return { responses, isLoading, error };
}

/**
 * Real-time hook for all user enrollments (for Home page)
 * Updates when any enrollment changes
 */
export function useUserEnrollmentsRealtime(userId: string): {
  enrollments: CampaignEnrollment[];
  isLoading: boolean;
  error: Error | null;
} {
  const [enrollments, setEnrollments] = useState<CampaignEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const q = query(
      collection(db, CAMPAIGN_ENROLLMENTS_COLLECTION),
      where('userId', '==', userId),
      orderBy('enrolledAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const enrollmentsList = snapshot.docs.map((docSnap) =>
          buildEnrollmentFromData(docSnap.id, docSnap.data())
        );
        setEnrollments(enrollmentsList);
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error listening to enrollments:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { enrollments, isLoading, error };
}

