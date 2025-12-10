'use client';

import { useState, useEffect } from 'react';
import { CompetencyDefinition, COMPETENCIES } from '@/lib/competencies';
import { getCompetencies, initializeCompetencies, subscribeToCompetencies } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';

interface UseCompetenciesOptions {
  realtime?: boolean;
}

interface UseCompetenciesReturn {
  competencies: CompetencyDefinition[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch competencies from Firestore
 * Falls back to default COMPETENCIES if Firestore fetch fails
 * 
 * @param options.realtime - If true, subscribes to real-time updates (default: false)
 */
export function useCompetencies(options: UseCompetenciesOptions = {}): UseCompetenciesReturn {
  const { realtime = false } = options;
  const { user } = useAuth();
  
  const [competencies, setCompetencies] = useState<CompetencyDefinition[]>(COMPETENCIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCompetencies = async () => {
    // Don't fetch if not authenticated - use defaults
    if (!user) {
      setCompetencies(COMPETENCIES);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Initialize with defaults if collection is empty
      await initializeCompetencies(COMPETENCIES);
      
      // Fetch competencies
      const data = await getCompetencies();
      
      if (data.length > 0) {
        setCompetencies(data);
      } else {
        // Fallback to defaults if still empty
        setCompetencies(COMPETENCIES);
      }
    } catch (err) {
      console.error('Failed to fetch competencies:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch competencies'));
      // Fallback to defaults on error
      setCompetencies(COMPETENCIES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Don't setup subscriptions if not authenticated
    if (!user) {
      setCompetencies(COMPETENCIES);
      setLoading(false);
      return;
    }

    if (realtime) {
      // Use real-time subscription
      let unsubscribe: (() => void) | undefined;
      
      const setup = async () => {
        setLoading(true);
        
        try {
          // Initialize with defaults if collection is empty
          await initializeCompetencies(COMPETENCIES);
          
          // Subscribe to real-time updates
          unsubscribe = subscribeToCompetencies((data) => {
            if (data.length > 0) {
              setCompetencies(data);
            } else {
              setCompetencies(COMPETENCIES);
            }
            setLoading(false);
          });
        } catch (err) {
          console.error('Failed to setup competencies subscription:', err);
          setError(err instanceof Error ? err : new Error('Failed to setup subscription'));
          setCompetencies(COMPETENCIES);
          setLoading(false);
        }
      };
      
      setup();
      
      return () => {
        unsubscribe?.();
      };
    } else {
      // One-time fetch
      fetchCompetencies();
    }
  }, [realtime, user]);

  return {
    competencies,
    loading,
    error,
    refetch: fetchCompetencies,
  };
}

/**
 * Get a competency by ID from a list of competencies
 */
export function getCompetencyById(
  competencies: CompetencyDefinition[],
  id: string
): CompetencyDefinition | undefined {
  return competencies.find(c => c.id === id);
}

/**
 * Get a competency by name from a list of competencies
 */
export function getCompetencyByName(
  competencies: CompetencyDefinition[],
  name: string
): CompetencyDefinition | undefined {
  return competencies.find(c => c.name === name);
}

/**
 * Get all skills from all competencies
 */
export function getAllSkills(competencies: CompetencyDefinition[]) {
  return competencies.flatMap(c => 
    c.skills.map(s => ({
      ...s,
      competencyId: c.id,
      competencyName: c.name,
    }))
  );
}

