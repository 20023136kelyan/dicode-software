import { useEffect, useState } from 'react';
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
 */
export function useEnrollmentRealtime(
  campaignId: string,
  userId: string
): { enrollment: CampaignEnrollment | null; isLoading: boolean; error: Error | null } {
  const [enrollment, setEnrollment] = useState<CampaignEnrollment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!campaignId || !userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let unsubscribe: (() => void) | null = null;

    // First, get enrollment ID (one-time query)
    const findEnrollment = async () => {
      try {
        const existingEnrollment = await checkUserEnrollment(campaignId, userId);

        if (existingEnrollment) {
          // Set up real-time listener on enrollment document
          const enrollmentRef = doc(db, CAMPAIGN_ENROLLMENTS_COLLECTION, existingEnrollment.id);

          unsubscribe = onSnapshot(
            enrollmentRef,
            (snapshot) => {
              if (snapshot.exists()) {
                const updatedEnrollment = buildEnrollmentFromData(snapshot.id, snapshot.data());
                setEnrollment(updatedEnrollment);
                setError(null);
                setIsLoading(false);
              } else {
                setEnrollment(null);
                setIsLoading(false);
              }
            },
            (err) => {
              console.error('Error listening to enrollment:', err);
              setError(err);
              setIsLoading(false);
            }
          );
        } else {
          // No enrollment yet - create it
          try {
            await enrollUserInCampaign(campaignId, userId, '', 'system', true);
            // Retry after enrollment creation
            findEnrollment();
          } catch (err) {
            console.error('Failed to create enrollment:', err);
            setError(err as Error);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to find enrollment:', err);
        setError(err as Error);
        setIsLoading(false);
      }
    };

    findEnrollment();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [campaignId, userId]);

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
          // Map by questionId for easy lookup
          responsesMap[data.questionId] = response;
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

