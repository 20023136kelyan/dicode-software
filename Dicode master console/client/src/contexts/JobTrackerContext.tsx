'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { BackgroundJob, ShotData, GenerationResult } from '@/lib/types';
import { getGenerationResult } from '@/lib/api';
import { useAuth } from './AuthContext';
import { saveGeneratedVideos } from '@/lib/saveGeneratedVideo';
import { useNotification } from './NotificationContext';

interface JobTrackerContextType {
  jobs: BackgroundJob[];
  activeJobs: BackgroundJob[];
  addJob: (taskId: string, shots: ShotData[], quality: string, model: string) => void;
  updateJobProgress: (taskId: string, progress: { [shotNumber: number]: number }) => void;
  completeJob: (taskId: string, result: GenerationResult) => void;
  failJob: (taskId: string, error: string) => void;
  removeJob: (taskId: string) => void;
  clearCompleted: () => void;
  getActiveJob: () => BackgroundJob | null;
  getJob: (taskId: string) => BackgroundJob | undefined;
}

const JobTrackerContext = createContext<JobTrackerContextType | undefined>(undefined);

const STORAGE_KEY = 'video-gen-jobs';
const MAX_JOBS = 20;
const JOB_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const POLL_INTERVAL = 2000; // 2 seconds

export function JobTrackerProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const { user } = useAuth();
  const { success, error: showError } = useNotification();

  // Load jobs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: BackgroundJob[] = JSON.parse(stored);
        // Filter out expired jobs
        const now = Date.now();
        const valid = parsed.filter(job => (now - job.createdAt) < JOB_EXPIRY_MS);
        setJobs(valid);
      }
    } catch (error) {
      console.error('Failed to load jobs from localStorage:', error);
    }
  }, []);

  // Save jobs to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    } catch (error) {
      console.error('Failed to save jobs to localStorage:', error);
    }
  }, [jobs]);

  // Background polling for active jobs
  useEffect(() => {
    const activeJobs = jobs.filter(job => job.status === 'running' || job.status === 'pending');

    if (activeJobs.length === 0) return;

    console.log(`🔄 JobTracker: Polling ${activeJobs.length} active jobs`);

    const pollJobs = async () => {
      for (const job of activeJobs) {
        try {
          const result = await getGenerationResult(job.taskId);
          console.log(`📊 JobTracker: Poll result for ${job.taskId}:`, result);

          if (result.status === 'completed' || result.sequence_id) {
            console.log(`✅ JobTracker: Job ${job.taskId} completed`);

            // Update job to completed
            setJobs(prev => prev.map(j =>
              j.taskId === job.taskId
                ? { ...j, status: 'completed' as const, updatedAt: Date.now(), result }
                : j
            ));

            // Auto-save to Firebase if user is logged in and video_ids exist
            if (user && result.video_ids && result.sequence_id) {
              console.log(`💾 JobTracker: Auto-saving job ${job.taskId} to Firebase`);

              try {
                await saveGeneratedVideos({
                  userId: user.uid,
                  userEmail: user.email || undefined,
                  userName: user.displayName || undefined,
                  result,
                  shots: job.shots,
                  quality: job.quality,
                  model: job.model,
                  onProgress: (progress) => {
                    console.log(`📤 Upload progress:`, progress);
                  },
                });

                success('Video Saved', 'Generated video has been saved to your library');
              } catch (error) {
                console.error('Failed to save videos to Firebase:', error);
                showError('Save Failed', error instanceof Error ? error.message : 'Failed to save video to library');
              }
            } else {
              success('Generation Complete', 'Video generation completed successfully');
            }
          } else if (result.status === 'error') {
            console.log(`❌ JobTracker: Job ${job.taskId} failed`);
            setJobs(prev => prev.map(j =>
              j.taskId === job.taskId
                ? { ...j, status: 'error' as const, updatedAt: Date.now(), error: result.error || 'Unknown error' }
                : j
            ));

            showError('Generation Failed', result.error || 'Video generation failed');
          }
        } catch (error: any) {
          // Ignore 404 errors - job is still in progress
          if (error?.response?.status === 404) {
            console.log(`⏳ JobTracker: Job ${job.taskId} still in progress (404)`);
          } else {
            console.error(`❌ JobTracker: Failed to poll job ${job.taskId}:`, error);
          }
        }
      }
    };

    // Poll immediately
    pollJobs();

    // Then poll on interval
    const interval = setInterval(pollJobs, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [jobs, user, success, showError]);

  const addJob = useCallback((taskId: string, shots: ShotData[], quality: string, model: string) => {
    console.log(`➕ JobTracker: Adding job ${taskId}`);

    const newJob: BackgroundJob = {
      taskId,
      status: 'running',
      progress: {},
      shots,
      quality,
      model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setJobs(prev => {
      // Remove oldest jobs if we're at the limit
      const updated = [newJob, ...prev];
      if (updated.length > MAX_JOBS) {
        return updated.slice(0, MAX_JOBS);
      }
      return updated;
    });
  }, []);

  const updateJobProgress = useCallback((taskId: string, progress: { [shotNumber: number]: number }) => {
    setJobs(prev => prev.map(job =>
      job.taskId === taskId
        ? { ...job, progress, updatedAt: Date.now() }
        : job
    ));
  }, []);

  const completeJob = useCallback((taskId: string, result: GenerationResult) => {
    console.log(`✅ JobTracker: Completing job ${taskId}`);
    setJobs(prev => prev.map(job =>
      job.taskId === taskId
        ? { ...job, status: 'completed' as const, updatedAt: Date.now(), result }
        : job
    ));
  }, []);

  const failJob = useCallback((taskId: string, error: string) => {
    console.log(`❌ JobTracker: Failing job ${taskId}:`, error);
    setJobs(prev => prev.map(job =>
      job.taskId === taskId
        ? { ...job, status: 'error' as const, updatedAt: Date.now(), error }
        : job
    ));
  }, []);

  const removeJob = useCallback((taskId: string) => {
    console.log(`🗑️ JobTracker: Removing job ${taskId}`);
    setJobs(prev => prev.filter(job => job.taskId !== taskId));
  }, []);

  const clearCompleted = useCallback(() => {
    console.log(`🧹 JobTracker: Clearing completed jobs`);
    setJobs(prev => prev.filter(job => job.status === 'running' || job.status === 'pending'));
  }, []);

  const getActiveJob = useCallback((): BackgroundJob | null => {
    const active = jobs.find(job => job.status === 'running' || job.status === 'pending');
    return active || null;
  }, [jobs]);

  const getJob = useCallback((taskId: string): BackgroundJob | undefined => {
    return jobs.find(job => job.taskId === taskId);
  }, [jobs]);

  const activeJobs = jobs.filter(job => job.status === 'running' || job.status === 'pending');

  const value = {
    jobs,
    activeJobs,
    addJob,
    updateJobProgress,
    completeJob,
    failJob,
    removeJob,
    clearCompleted,
    getActiveJob,
    getJob,
  };

  return (
    <JobTrackerContext.Provider value={value}>
      {children}
    </JobTrackerContext.Provider>
  );
}

export function useJobTracker() {
  const context = useContext(JobTrackerContext);
  if (context === undefined) {
    throw new Error('useJobTracker must be used within a JobTrackerProvider');
  }
  return context;
}
