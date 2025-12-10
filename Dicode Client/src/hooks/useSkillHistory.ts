import { useEffect, useState, useCallback } from 'react';
import { getSkillProgressOverTime, getSkillAssessmentHistory } from '@/lib/firestore';
import type { SkillAssessment } from '@/types';

export interface SkillProgressData {
  dates: string[];
  competencies: {
    [competencyId: string]: {
      name: string;
      scores: (number | null)[];
    };
  };
  skills: {
    [skillId: string]: {
      name: string;
      competencyId: string;
      scores: (number | null)[];
    };
  };
}

const defaultProgress: SkillProgressData = {
  dates: [],
  competencies: {},
  skills: {},
};

/**
 * Hook to fetch skill progress over time for charts
 * Returns aggregated data suitable for line charts showing skill/competency progression
 */
export function useSkillProgress(
  userId: string,
  organizationId: string,
  options?: {
    competencyId?: string;
    days?: number;
  }
): {
  progress: SkillProgressData;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const [progress, setProgress] = useState<SkillProgressData>(defaultProgress);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId || !organizationId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getSkillProgressOverTime(userId, organizationId, options);
      setProgress(data);
    } catch (err) {
      console.error('Error fetching skill progress:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch skill progress'));
    } finally {
      setIsLoading(false);
    }
  }, [userId, organizationId, options?.competencyId, options?.days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { progress, isLoading, error, refetch: fetchData };
}

/**
 * Hook to fetch raw skill assessment history
 * Useful for detailed views or custom chart processing
 */
export function useSkillAssessmentHistory(
  userId: string,
  organizationId: string,
  options?: {
    skillId?: string;
    competencyId?: string;
    limit?: number;
  }
): {
  assessments: SkillAssessment[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const [assessments, setAssessments] = useState<SkillAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId || !organizationId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getSkillAssessmentHistory(userId, organizationId, options);
      setAssessments(data);
    } catch (err) {
      console.error('Error fetching skill assessments:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch skill assessments'));
    } finally {
      setIsLoading(false);
    }
  }, [userId, organizationId, options?.skillId, options?.competencyId, options?.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { assessments, isLoading, error, refetch: fetchData };
}

/**
 * Transform skill progress data into chart-friendly format
 * Can be used with recharts or any chart library
 */
export function useChartData(progress: SkillProgressData, type: 'competencies' | 'skills' = 'competencies') {
  const data = progress.dates.map((date, index) => {
    const point: { date: string; [key: string]: string | number | null } = { date };

    if (type === 'competencies') {
      Object.entries(progress.competencies).forEach(([id, comp]) => {
        point[comp.name] = comp.scores[index];
      });
    } else {
      Object.entries(progress.skills).forEach(([id, skill]) => {
        point[skill.name] = skill.scores[index];
      });
    }

    return point;
  });

  // Filter out dates where all values are null (no data)
  const filteredData = data.filter(point => {
    const values = Object.values(point).filter(v => v !== point.date);
    return values.some(v => v !== null);
  });

  // Get unique labels (competency/skill names)
  const labels = type === 'competencies'
    ? Object.values(progress.competencies).map(c => c.name)
    : Object.values(progress.skills).map(s => s.name);

  return { data: filteredData, labels };
}
