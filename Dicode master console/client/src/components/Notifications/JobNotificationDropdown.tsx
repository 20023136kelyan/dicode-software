'use client';

import { useRouter } from 'next/navigation';
import { BackgroundJob } from '@/lib/types';
import { useJobTracker } from '@/contexts/JobTrackerContext';
import { CheckCircleIcon, XCircleIcon, ClockIcon, TrashIcon } from '@heroicons/react/24/outline';

interface JobNotificationDropdownProps {
  jobs: BackgroundJob[];
  onClose: () => void;
}

export default function JobNotificationDropdown({ jobs, onClose }: JobNotificationDropdownProps) {
  const router = useRouter();
  const { clearCompleted, removeJob } = useJobTracker();

  const activeJobs = jobs.filter(job => job.status === 'running' || job.status === 'pending');
  const completedJobs = jobs.filter(job => job.status === 'completed');
  const failedJobs = jobs.filter(job => job.status === 'error');

  const sortedJobs = [...activeJobs, ...failedJobs, ...completedJobs];

  const handleJobClick = (job: BackgroundJob) => {
    router.push('/generate');
    onClose();
  };

  const getStatusIcon = (status: BackgroundJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5 text-emerald-500" />;
      case 'error':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'running':
      case 'pending':
        return (
          <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        );
    }
  };

  const getStatusColor = (status: BackgroundJob['status']) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-600';
      case 'error':
        return 'text-red-600';
      case 'running':
      case 'pending':
        return 'text-sky-600';
    }
  };

  const getStatusText = (status: BackgroundJob['status']) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Failed';
      case 'running':
        return 'Generating...';
      case 'pending':
        return 'Pending...';
    }
  };

  const getJobTitle = (job: BackgroundJob) => {
    if (job.shots.length === 1) {
      const dialog = job.shots[0].dialog;
      return dialog.length > 40 ? `${dialog.substring(0, 40)}...` : dialog;
    }
    return `${job.shots.length} shots`;
  };

  const getOverallProgress = (job: BackgroundJob) => {
    const progressValues = Object.values(job.progress);
    if (progressValues.length === 0) return 0;
    const sum = progressValues.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / progressValues.length);
  };

  const formatTimestamp = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className="absolute top-full mt-2 right-0 w-96 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-[60] animate-fadeIn">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Background Jobs</h3>
          {(completedJobs.length > 0 || failedJobs.length > 0) && (
            <button
              onClick={() => {
                clearCompleted();
              }}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              Clear Completed
            </button>
          )}
        </div>
      </div>

      {/* Job List */}
      <div className="max-h-96 overflow-y-auto">
        {sortedJobs.length === 0 ? (
          <div className="p-8 text-center">
            <ClockIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No background jobs</p>
            <p className="text-xs text-gray-400 mt-1">
              Start generating a video to see it here
            </p>
          </div>
        ) : (
          sortedJobs.map((job) => {
            const progress = getOverallProgress(job);

            return (
              <div
                key={job.taskId}
                className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => handleJobClick(job)}
              >
                {/* Job Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 mt-0.5">
                      {getStatusIcon(job.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {getJobTitle(job)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-medium ${getStatusColor(job.status)}`}>
                          {getStatusText(job.status)}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(job.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  {(job.status === 'completed' || job.status === 'error') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeJob(job.taskId);
                      }}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Remove job"
                    >
                      <TrashIcon className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>

                {/* Progress Bar (for running jobs) */}
                {(job.status === 'running' || job.status === 'pending') && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Progress</span>
                      <span className="text-gray-700 font-medium">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-sky-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {job.status === 'error' && job.error && (
                  <p className="text-xs text-red-600 mt-2 line-clamp-2">
                    {job.error}
                  </p>
                )}

                {/* Model & Quality Tags */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {job.model}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {job.quality}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
