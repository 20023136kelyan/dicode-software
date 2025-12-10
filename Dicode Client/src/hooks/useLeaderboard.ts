import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatar?: string;
  role?: string;
  department?: string;
  totalXp: number;
  level: number;
  levelTitle: string;
  levelTier: 'newcomer' | 'learner' | 'achiever' | 'expert' | 'master';
  rank: number;
  totalCompletedCampaigns: number;
  currentStreak: number;
}

interface UseLeaderboardResult {
  leaderboard: LeaderboardEntry[];
  userRank: LeaderboardEntry | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch organization leaderboard ranked by XP
 */
export function useLeaderboard(
  organizationId: string,
  currentUserId: string,
  maxEntries: number = 50
): UseLeaderboardResult {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!organizationId || !currentUserId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let unsubscribe: (() => void) | null = null;
    let isCancelled = false;

    // We need to join userStats with users collection to get names
    // First, get all users in the organization
    const fetchLeaderboard = async () => {
      try {
        // Get users in the organization
        const usersQuery = query(
          collection(db, 'users'),
          where('organization', '==', organizationId)
        );
        const usersSnapshot = await getDocs(usersQuery);

        // Check if effect was cancelled during async operation
        if (isCancelled) return;

        const userMap = new Map<string, { name: string; avatar?: string; role?: string; department?: string }>();
        usersSnapshot.docs.forEach(doc => {
          const data = doc.data();
          userMap.set(doc.id, {
            name: data.name || data.email?.split('@')[0] || 'Unknown',
            avatar: data.photoURL || data.avatar,
            role: data.role,
            department: data.department,
          });
        });

        // Now listen to userStats for these users
        const userIds = Array.from(userMap.keys());

        if (userIds.length === 0) {
          setLeaderboard([]);
          setUserRank(null);
          setIsLoading(false);
          return;
        }

        // Firestore 'in' queries are limited to 30 items
        // For larger orgs, we'd need pagination or a different approach
        const statsQuery = query(
          collection(db, 'userStats'),
          where('organizationId', '==', organizationId),
          orderBy('totalXp', 'desc'),
          limit(maxEntries)
        );

        unsubscribe = onSnapshot(
          statsQuery,
          (snapshot) => {
            if (isCancelled) return;

            const entries: LeaderboardEntry[] = [];
            let rank = 1;

            snapshot.docs.forEach((doc) => {
              const data = doc.data();
              const userId = doc.id;
              const userInfo = userMap.get(userId);

              if (userInfo) {
                entries.push({
                  userId,
                  name: userInfo.name,
                  avatar: userInfo.avatar,
                  role: userInfo.role,
                  department: userInfo.department,
                  totalXp: data.totalXp || 0,
                  level: data.level || 1,
                  levelTitle: data.levelTitle || 'Newcomer',
                  levelTier: data.levelTier || 'newcomer',
                  rank: rank++,
                  totalCompletedCampaigns: data.totalCompletedCampaigns || 0,
                  currentStreak: data.currentStreak || 0,
                });
              }
            });

            // Also add users who have no stats yet (0 XP)
            userMap.forEach((userInfo, userId) => {
              if (!entries.find(e => e.userId === userId)) {
                entries.push({
                  userId,
                  name: userInfo.name,
                  avatar: userInfo.avatar,
                  role: userInfo.role,
                  department: userInfo.department,
                  totalXp: 0,
                  level: 1,
                  levelTitle: 'Newcomer',
                  levelTier: 'newcomer',
                  rank: entries.length + 1,
                  totalCompletedCampaigns: 0,
                  currentStreak: 0,
                });
              }
            });

            // Re-sort and re-rank after adding missing users
            entries.sort((a, b) => b.totalXp - a.totalXp);
            entries.forEach((entry, index) => {
              entry.rank = index + 1;
            });

            setLeaderboard(entries);
            setUserRank(entries.find(e => e.userId === currentUserId) || null);
            setError(null);
            setIsLoading(false);
          },
          (err) => {
            if (isCancelled) return;
            console.error('Error fetching leaderboard:', err);
            setError(err);
            setIsLoading(false);
          }
        );
      } catch (err) {
        if (isCancelled) return;
        console.error('Error setting up leaderboard:', err);
        setError(err as Error);
        setIsLoading(false);
      }
    };

    fetchLeaderboard();

    return () => {
      isCancelled = true;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [organizationId, currentUserId, maxEntries]);

  return { leaderboard, userRank, isLoading, error };
}

/**
 * Get tier color classes
 */
export function getTierColor(tier: LeaderboardEntry['levelTier']): {
  bg: string;
  text: string;
  border: string;
  gradient: string;
} {
  switch (tier) {
    case 'master':
      return {
        bg: 'bg-purple-500/10',
        text: 'text-purple-500',
        border: 'border-purple-500/30',
        gradient: 'from-purple-500 to-pink-500',
      };
    case 'expert':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-500',
        border: 'border-amber-500/30',
        gradient: 'from-amber-500 to-orange-500',
      };
    case 'achiever':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-500',
        border: 'border-blue-500/30',
        gradient: 'from-blue-500 to-cyan-500',
      };
    case 'learner':
      return {
        bg: 'bg-green-500/10',
        text: 'text-green-500',
        border: 'border-green-500/30',
        gradient: 'from-green-500 to-emerald-500',
      };
    default:
      return {
        bg: 'bg-gray-500/10',
        text: 'text-gray-500',
        border: 'border-gray-500/30',
        gradient: 'from-gray-500 to-slate-500',
      };
  }
}
