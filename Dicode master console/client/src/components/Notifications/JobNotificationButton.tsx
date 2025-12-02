'use client';

import { useState, useEffect, useRef } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useJobTracker } from '@/contexts/JobTrackerContext';
import JobNotificationDropdown from './JobNotificationDropdown';

export default function JobNotificationButton() {
  const [showDropdown, setShowDropdown] = useState(false);
  const { activeJobs, jobs } = useJobTracker();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const hasActiveJobs = activeJobs.length > 0;
  const activeCount = activeJobs.length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 rounded-lg bg-white border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 transition-all"
        title="View background jobs"
      >
        <BellIcon className="w-5 h-5" />

        {/* Badge for active job count */}
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-sky-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}

        {/* Pulsing dot indicator for active jobs */}
        {hasActiveJobs && (
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <JobNotificationDropdown
          jobs={jobs}
          onClose={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}
