import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';

// ============================================
// TYPES
// ============================================

export interface CompetencyScore {
  name: string;
  averageScore: number;
  averageLevel: number;
  assessedCount: number;
}

export interface CampaignStats {
  completedCount: number;
  inProgressCount: number;
  totalEnrollments: number;
}

export interface DepartmentAnalytics {
  totalEmployees: number;
  overallScore: number;
  competencyScores: {
    'psychological-safety': { averageScore: number; averageLevel: number; assessedCount: number };
    'prosocial-norms': { averageScore: number; averageLevel: number; assessedCount: number };
    'collaboration': { averageScore: number; averageLevel: number; assessedCount: number };
    'growth': { averageScore: number; averageLevel: number; assessedCount: number };
  };
}

export interface DepartmentHistoryData {
  overallScore: number;
  competencyScores: {
    'psychological-safety': number;
    'prosocial-norms': number;
    'collaboration': number;
    'growth': number;
  };
  totalEmployees: number;
}

export interface OrganizationAnalytics {
  organizationId: string;
  updatedAt: any;

  // Summary metrics
  totalEmployees: number;
  activeUsersLast30Days: number;
  overallScore: number;
  completionRate: number;
  engagementRate: number;

  // Competency averages
  competencyScores: {
    'psychological-safety': CompetencyScore;
    'prosocial-norms': CompetencyScore;
    'collaboration': CompetencyScore;
    'growth': CompetencyScore;
  };

  // Campaign stats
  campaignStats: CampaignStats;

  // Department-level analytics (optional, populated by updated Cloud Function)
  departmentAnalytics?: Record<string, DepartmentAnalytics>;
}

export interface AnalyticsHistoryPoint {
  date: string;
  overallScore: number;
  competencyScores: {
    'psychological-safety': number;
    'prosocial-norms': number;
    'collaboration': number;
    'growth': number;
  };
  totalEmployees: number;
  completionRate: number;
  engagementRate: number;
  // Department-level history data (optional, populated by updated Cloud Function)
  departmentAnalytics?: Record<string, DepartmentHistoryData>;
}

// ============================================
// MAIN HOOK - Real-time current analytics
// ============================================

/**
 * Real-time hook to listen to organization analytics
 * Data is computed daily by Cloud Functions and stored in organizationAnalytics collection
 */
export function useOrganizationAnalyticsRealtime(organizationId: string | null): {
  analytics: OrganizationAnalytics | null;
  isLoading: boolean;
  error: Error | null;
} {
  const [analytics, setAnalytics] = useState<OrganizationAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const analyticsRef = doc(db, 'organizationAnalytics', organizationId);

    const unsubscribe = onSnapshot(
      analyticsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setAnalytics(snapshot.data() as OrganizationAnalytics);
        } else {
          // No analytics yet - might need to trigger refresh
          setAnalytics(null);
        }
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error listening to organization analytics:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [organizationId]);

  return { analytics, isLoading, error };
}

// ============================================
// HISTORY HOOK - For trend charts
// ============================================

/**
 * Hook to fetch historical analytics data for charts
 * Returns time-series data for competency trends
 */
export function useOrganizationAnalyticsHistory(
  organizationId: string | null,
  options?: {
    startDate?: string;
    endDate?: string;
    maxPoints?: number;
  }
): {
  history: AnalyticsHistoryPoint[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [history, setHistory] = useState<AnalyticsHistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!organizationId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const historyRef = collection(db, 'organizationAnalytics', organizationId, 'history');
      let q = query(historyRef, orderBy('date', 'asc'));

      if (options?.startDate) {
        q = query(q, where('date', '>=', options.startDate));
      }
      if (options?.endDate) {
        q = query(q, where('date', '<=', options.endDate));
      }
      if (options?.maxPoints) {
        q = query(q, limit(options.maxPoints));
      } else {
        q = query(q, limit(365)); // Default to 1 year of data
      }

      const snapshot = await getDocs(q);
      const points = snapshot.docs.map(doc => doc.data() as AnalyticsHistoryPoint);

      setHistory(points);
      setError(null);
    } catch (err) {
      console.error('Error fetching analytics history:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, options?.startDate, options?.endDate, options?.maxPoints]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, isLoading, error, refetch: fetchHistory };
}

// ============================================
// MANUAL REFRESH HOOK
// ============================================

/**
 * Hook to manually trigger analytics refresh
 * Useful when you need immediate updates instead of waiting for daily cron
 */
export function useRefreshOrganizationAnalytics(): {
  refresh: (organizationId: string) => Promise<OrganizationAnalytics | null>;
  isRefreshing: boolean;
  error: Error | null;
} {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async (organizationId: string): Promise<OrganizationAnalytics | null> => {
    setIsRefreshing(true);
    setError(null);

    try {
      const refreshFn = httpsCallable(functions, 'refreshOrgAnalyticsManual');
      const result = await refreshFn({ organizationId });
      const data = result.data as { success: boolean; analytics: OrganizationAnalytics | null };

      if (data.success) {
        return data.analytics;
      }
      return null;
    } catch (err) {
      console.error('Error refreshing organization analytics:', err);
      setError(err as Error);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return { refresh, isRefreshing, error };
}

// ============================================
// COMBINED HOOK - Analytics with history
// ============================================

/**
 * Combined hook for analytics page - provides both current analytics and history
 */
export function useOrganizationAnalyticsWithHistory(
  organizationId: string | null,
  dateRange?: { startDate: string; endDate: string }
): {
  current: OrganizationAnalytics | null;
  history: AnalyticsHistoryPoint[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} {
  const { analytics: current, isLoading: currentLoading, error: currentError } =
    useOrganizationAnalyticsRealtime(organizationId);

  const { history, isLoading: historyLoading, error: historyError, refetch } =
    useOrganizationAnalyticsHistory(organizationId, dateRange);

  const { refresh: manualRefresh } = useRefreshOrganizationAnalytics();

  const refresh = useCallback(async () => {
    if (organizationId) {
      await manualRefresh(organizationId);
      await refetch();
    }
  }, [organizationId, manualRefresh, refetch]);

  return {
    current,
    history,
    isLoading: currentLoading || historyLoading,
    error: currentError || historyError,
    refresh,
  };
}

// ============================================
// HELPER: Transform history for Recharts
// ============================================

/**
 * Transform analytics history into format for Recharts line chart
 * Maps to the expected format in AnalyticsTrend.tsx
 * @param history - The history data points
 * @param selectedDepartment - Optional department to filter by ('all' or null for org-wide data)
 */
export function transformHistoryForChart(
  history: AnalyticsHistoryPoint[],
  selectedDepartment?: string | null
): Array<{
  date: string;
  overallScore: number;
  psychologicalSafety: number;
  prosocialNorms: number;
  collaboration: number;
  growth: number;
}> {
  return history.map(point => {
    // If a specific department is selected (not 'all'), use department data or zeros
    if (selectedDepartment && selectedDepartment !== 'all') {
      const deptData = point.departmentAnalytics?.[selectedDepartment];
      // Return department data if exists, otherwise return zeros (not org-wide fallback)
      return {
        date: formatDateForChart(point.date),
        overallScore: deptData?.overallScore || 0,
        psychologicalSafety: deptData?.competencyScores?.['psychological-safety'] || 0,
        prosocialNorms: deptData?.competencyScores?.['prosocial-norms'] || 0,
        collaboration: deptData?.competencyScores?.['collaboration'] || 0,
        growth: deptData?.competencyScores?.['growth'] || 0,
      };
    }

    // Default ('all' or no selection): return org-wide data
    return {
      date: formatDateForChart(point.date),
      overallScore: point.overallScore,
      psychologicalSafety: point.competencyScores['psychological-safety'] || 0,
      prosocialNorms: point.competencyScores['prosocial-norms'] || 0,
      collaboration: point.competencyScores['collaboration'] || 0,
      growth: point.competencyScores['growth'] || 0,
    };
  });
}

/**
 * Format date string for chart display
 */
function formatDateForChart(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get current analytics score for display, optionally filtered by department
 */
export function getCurrentScore(
  analytics: OrganizationAnalytics | null,
  selectedDepartment?: string | null
): { overallScore: number; totalEmployees: number } {
  if (!analytics) {
    return { overallScore: 0, totalEmployees: 0 };
  }

  // If a specific department is selected (not 'all'), use department data or zeros
  if (selectedDepartment && selectedDepartment !== 'all') {
    const deptData = analytics.departmentAnalytics?.[selectedDepartment];
    // Return department data if exists, otherwise return zeros (not org-wide fallback)
    return {
      overallScore: deptData?.overallScore || 0,
      totalEmployees: deptData?.totalEmployees || 0,
    };
  }

  // Default ('all' or no selection): org-wide data
  return {
    overallScore: analytics.overallScore,
    totalEmployees: analytics.totalEmployees,
  };
}

/**
 * Calculate trend percentage change between two periods
 */
export function calculateTrendChange(
  history: AnalyticsHistoryPoint[],
  metric: 'overallScore' | 'completionRate' | 'engagementRate'
): { change: number; trend: 'up' | 'down' | 'neutral' } {
  if (history.length < 2) {
    return { change: 0, trend: 'neutral' };
  }

  const recent = history.slice(-7); // Last 7 days
  const previous = history.slice(-14, -7); // Previous 7 days

  if (recent.length === 0 || previous.length === 0) {
    return { change: 0, trend: 'neutral' };
  }

  const recentAvg = recent.reduce((sum, p) => sum + p[metric], 0) / recent.length;
  const previousAvg = previous.reduce((sum, p) => sum + p[metric], 0) / previous.length;

  if (previousAvg === 0) {
    return { change: 0, trend: 'neutral' };
  }

  const change = ((recentAvg - previousAvg) / previousAvg) * 100;
  const trend = change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'neutral';

  return { change: Math.round(change * 100) / 100, trend };
}
