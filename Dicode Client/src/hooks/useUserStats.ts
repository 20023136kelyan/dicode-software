import { useEffect, useState, useMemo } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CampaignEnrollment, SkillScore, CompetencyScoreAggregate } from '@/types';

export interface UserStats {
  // Streak data
  currentStreak: number;
  completedToday: boolean;
  streakAtRisk: boolean;
  lastCompletionDate: string | null;
  longestStreak: number;
  totalCompletedCampaigns: number;
  streakDays: boolean[]; // Mon-Sun completion for current week
  // XP data
  totalXp: number;
  level: number;
  levelTitle: string;
  levelTier: 'newcomer' | 'learner' | 'achiever' | 'expert' | 'master';
  xpToNextLevel: number;
  xpInCurrentLevel: number;
  // UI state (client-side tracking)
  lastCelebratedLevel?: number;
}

const defaultStats: UserStats = {
  // Streak defaults
  currentStreak: 0,
  completedToday: false,
  streakAtRisk: false,
  lastCompletionDate: null,
  longestStreak: 0,
  totalCompletedCampaigns: 0,
  streakDays: [false, false, false, false, false, false, false],
  // XP defaults
  totalXp: 0,
  level: 1,
  levelTitle: 'Newcomer',
  levelTier: 'newcomer',
  xpToNextLevel: 100,
  xpInCurrentLevel: 0,
  // UI state
  lastCelebratedLevel: 0,
};

/**
 * Real-time hook to listen to server-computed user stats
 * Stats are calculated by Cloud Functions and stored in the `userStats` collection
 */
export function useUserStatsRealtime(userId: string): {
  stats: UserStats;
  isLoading: boolean;
  error: Error | null;
} {
  const [stats, setStats] = useState<UserStats>(defaultStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Listen to the userStats document in real-time
    const userStatsRef = doc(db, 'userStats', userId);

    const unsubscribe = onSnapshot(
      userStatsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setStats({
            // Streak data
            currentStreak: data.currentStreak || 0,
            completedToday: data.completedToday || false,
            streakAtRisk: data.streakAtRisk || false,
            lastCompletionDate: data.lastCompletionDate || null,
            longestStreak: data.longestStreak || 0,
            totalCompletedCampaigns: data.totalCompletedCampaigns || 0,
            streakDays: data.streakDays || [false, false, false, false, false, false, false],
            // XP data
            totalXp: data.totalXp || 0,
            level: data.level || 1,
            levelTitle: data.levelTitle || 'Newcomer',
            levelTier: data.levelTier || 'newcomer',
            xpToNextLevel: data.xpToNextLevel || 100,
            xpInCurrentLevel: data.xpInCurrentLevel || 0,
            // UI state
            lastCelebratedLevel: data.lastCelebratedLevel || 0,
          });
        } else {
          // No stats yet - user hasn't completed any campaigns
          setStats(defaultStats);
        }
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error listening to user stats:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { stats, isLoading, error };
}

/**
 * Update the last celebrated level in Firestore
 * This is used to track which level the user has seen the celebration for
 */
export async function updateLastCelebratedLevel(userId: string, level: number): Promise<void> {
  if (!userId) return;
  
  const userStatsRef = doc(db, 'userStats', userId);
  try {
    await updateDoc(userStatsRef, {
      lastCelebratedLevel: level,
    });
  } catch (error: any) {
    // If document doesn't exist, create it with setDoc
    if (error.code === 'not-found') {
      await setDoc(userStatsRef, {
        lastCelebratedLevel: level,
      }, { merge: true });
    } else {
      console.error('Error updating lastCelebratedLevel:', error);
    }
  }
}

/**
 * Calculate streak days for the current week based on actual completion dates.
 * Returns an array of 7 booleans representing Mon-Sun.
 * Only shows completions that happened THIS WEEK (not from previous weeks).
 */
function calculateStreakDaysFromDates(completionDates: Set<string>): boolean[] {
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
    const dateStr = checkDate.toISOString().split('T')[0];

    if (completionDates.has(dateStr)) {
      streakDays[i] = true;
    }
  }

  return streakDays;
}

/**
 * Derive streak stats from enrollments (fallback for when server stats aren't available)
 * Use this when you already have enrollment data from useUserEnrollmentsRealtime
 * This provides immediate feedback before the Cloud Function updates
 */
export function useStreakFromEnrollments(enrollments: CampaignEnrollment[]): {
  currentStreak: number;
  completedToday: boolean;
  streakAtRisk: boolean;
  streakDays: boolean[];
} {
  return useMemo(() => {
    // Get completion dates from completed enrollments
    const completionDates = new Set<string>();

    enrollments.forEach(enrollment => {
      if (enrollment.status === 'completed' && enrollment.completedAt) {
        const completedDate = new Date(enrollment.completedAt);
        const dateStr = completedDate.toISOString().split('T')[0];
        completionDates.add(dateStr);
      }
    });

    // Sort dates in descending order
    const sortedDates = Array.from(completionDates).sort().reverse();

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const completedToday = sortedDates.includes(today);
    const completedYesterday = sortedDates.includes(yesterday);

    // Calculate streak
    let currentStreak = 0;

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

    const streakAtRisk = !completedToday && completedYesterday && currentStreak > 0;
    // Use actual completion dates for current week's dots
    const streakDays = calculateStreakDaysFromDates(completionDates);

    return {
      currentStreak,
      completedToday,
      streakAtRisk,
      streakDays,
    };
  }, [enrollments]);
}

/**
 * Combined hook that uses server stats when available, falls back to client calculation
 * This ensures immediate UI updates while waiting for Cloud Function to process
 */
export function useUserStatsWithFallback(
  userId: string,
  enrollments: CampaignEnrollment[]
): {
  stats: UserStats;
  isLoading: boolean;
  error: Error | null;
} {
  const { stats: serverStats, isLoading: serverLoading, error: serverError } = useUserStatsRealtime(userId);
  const clientStreak = useStreakFromEnrollments(enrollments);

  // Use server stats if available and up-to-date, otherwise use client-computed
  const stats = useMemo(() => {
    // If server has stats and they're recent enough, use them
    if (!serverLoading && serverStats.lastCompletionDate) {
      return serverStats;
    }

    // Fall back to client-computed stats
    return {
      ...defaultStats,
      currentStreak: clientStreak.currentStreak,
      completedToday: clientStreak.completedToday,
      streakAtRisk: clientStreak.streakAtRisk,
      streakDays: clientStreak.streakDays,
    };
  }, [serverStats, serverLoading, clientStreak]);

  return {
    stats,
    isLoading: serverLoading,
    error: serverError,
  };
}

// ============================================
// SKILL SCORES TRACKING
// ============================================

export interface SkillScoresState {
  skills: Record<string, SkillScore>;
  competencyScores: Record<string, CompetencyScoreAggregate>;
}

const defaultSkillScores: SkillScoresState = {
  skills: {},
  competencyScores: {},
};

/**
 * Real-time hook to listen to user's skill scores from userSkillProfiles collection
 * Skill scores are computed by Cloud Functions when users answer questions
 */
export function useSkillScoresRealtime(userId: string): {
  skillScores: SkillScoresState;
  isLoading: boolean;
  error: Error | null;
} {
  const [skillScores, setSkillScores] = useState<SkillScoresState>(defaultSkillScores);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Listen to the userSkillProfiles document in real-time
    const profileRef = doc(db, 'userSkillProfiles', userId);

    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setSkillScores({
            skills: data.skills || {},
            competencyScores: data.competencyScores || {},
          });
        } else {
          // No skill profile yet
          setSkillScores(defaultSkillScores);
        }
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error listening to skill scores:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { skillScores, isLoading, error };
}

/**
 * Helper to get top N skills by score
 */
export function getTopSkills(skills: Record<string, SkillScore>, limit: number = 5): SkillScore[] {
  return Object.values(skills)
    .sort((a, b) => b.currentScore - a.currentScore)
    .slice(0, limit);
}

/**
 * Helper to get skills that need improvement (lowest scores)
 */
export function getSkillsNeedingImprovement(
  skills: Record<string, SkillScore>,
  limit: number = 3
): SkillScore[] {
  return Object.values(skills)
    .filter((skill) => skill.assessmentCount > 0) // Only assessed skills
    .sort((a, b) => a.currentScore - b.currentScore)
    .slice(0, limit);
}

/**
 * Helper to get competencies sorted by score
 */
export function getSortedCompetencies(
  competencyScores: Record<string, CompetencyScoreAggregate>
): CompetencyScoreAggregate[] {
  return Object.values(competencyScores).sort((a, b) => b.currentScore - a.currentScore);
}

// ============================================
// BADGE SYSTEM
// ============================================

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'completion' | 'level' | 'skill' | 'special';
  earnedAt?: string;
}

/**
 * Real-time hook to listen to user badges from userStats
 */
export function useBadgesRealtime(userId: string): {
  badges: Badge[];
  isLoading: boolean;
  error: Error | null;
} {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const userStatsRef = doc(db, 'userStats', userId);

    const unsubscribe = onSnapshot(
      userStatsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          // badgeDetails contains full badge info with earnedAt
          const badgeDetails = data.badgeDetails || [];
          // Deduplicate badges by ID (in case of duplicate entries)
          const uniqueBadges = badgeDetails.reduce((acc: Badge[], badge: Badge) => {
            if (!acc.find(b => b.id === badge.id)) {
              acc.push(badge);
            }
            return acc;
          }, []);
          setBadges(uniqueBadges);
        } else {
          setBadges([]);
        }
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error listening to user badges:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { badges, isLoading, error };
}

/**
 * Get badges by category
 */
export function getBadgesByCategory(badges: Badge[], category: Badge['category']): Badge[] {
  return badges.filter((badge) => badge.category === category);
}

/**
 * Get most recent badges
 */
export function getRecentBadges(badges: Badge[], limit: number = 5): Badge[] {
  return [...badges]
    .sort((a, b) => {
      const dateA = a.earnedAt ? new Date(a.earnedAt).getTime() : 0;
      const dateB = b.earnedAt ? new Date(b.earnedAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, limit);
}
