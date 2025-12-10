import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

interface TimeSeriesPoint {
  date: string;
  daily: number;
  cumulative: number;
}

interface WeeklyTrend {
  week: string;
  responses: number;
  cumulative: number;
}

interface DailyDistribution {
  day: string;
  count: number;
}

interface CampaignStats {
  enrolled: number;
  completed: number;
  inProgress: number;
  avgCompletion: number;
  totalResponses: number;
}

interface CompletionStatus {
  completed: number;
  inProgress: number;
  notStarted: number;
}

export interface SkillAggregate {
  skillId: string;
  skillName: string;
  avgScore: number;
  count: number;
}

export interface QuestionAggregate {
  question: {
    id: string;
    type: 'behavioral-perception' | 'behavioral-intent' | 'qualitative';
    statement: string;
    benchmarkScore?: number;
    options?: Array<{ id: string; text: string; intentScore: number }>;
    competency?: string;
    competencyId?: string;
    skillId?: string;
  };
  responses: Array<{
    id: string;
    answer: number | string | object;
    selectedOptionId?: string;
    intentScore?: number;
  }>;
  distribution?: Record<number, number>;
  choiceDistribution?: Record<string, number>;
  avgScore?: number;
  benchmarkOptionId?: string;
}

export interface VideoAggregate {
  videoId: string;
  videoTitle: string;
  questions: QuestionAggregate[];
}

export interface CampaignAnalytics {
  enrollmentsOverTime: TimeSeriesPoint[];
  completionsOverTime: TimeSeriesPoint[];
  weeklyResponseTrends: WeeklyTrend[];
  dailyDistribution: DailyDistribution[];
  stats: CampaignStats;
  completionStatus: CompletionStatus;
  skillAggregates: SkillAggregate[];
  videoAggregates: VideoAggregate[];
}

interface UseCampaignAnalyticsReturn {
  analytics: CampaignAnalytics | null;
  isLoading: boolean;
  error: Error | null;
  fetchAnalytics: (
    campaignId: string,
    organizationId: string,
    departmentFilter?: string,
    cohortFilter?: string
  ) => Promise<void>;
  clearAnalytics: () => void;
}

export function useCampaignAnalytics(): UseCampaignAnalyticsReturn {
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAnalytics = useCallback(async (
    campaignId: string,
    organizationId: string,
    departmentFilter?: string,
    cohortFilter?: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const getCampaignAnalyticsFn = httpsCallable(functions, 'getCampaignAnalytics');
      const result = await getCampaignAnalyticsFn({
        campaignId,
        organizationId,
        departmentFilter: departmentFilter || 'all',
        cohortFilter: cohortFilter || 'all'
      });

      setAnalytics(result.data as CampaignAnalytics);
    } catch (err) {
      console.error('Failed to fetch campaign analytics:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearAnalytics = useCallback(() => {
    setAnalytics(null);
    setError(null);
  }, []);

  return { analytics, isLoading, error, fetchAnalytics, clearAnalytics };
}
