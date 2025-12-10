import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Sparkles, Clock, CalendarClock, CalendarX, CalendarCheck } from 'lucide-react';
import BottomSheet from './BottomSheet';

export interface FilterOptions {
  status: 'all' | 'not-started' | 'in-progress' | 'completed';
  source: 'all' | 'organization' | 'dicode';
  duration: 'any' | 'under30' | '30to60' | 'over60';
  deadline: 'any' | 'has-deadline' | 'no-deadline' | 'due-this-week';
}

export const defaultFilters: FilterOptions = {
  status: 'all',
  source: 'all',
  duration: 'any',
  deadline: 'any',
};

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterOptions;
  onApply: (filters: FilterOptions) => void;
}

interface SegmentedOptionProps {
  icon?: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const SegmentedOption: React.FC<SegmentedOptionProps> = ({ icon, label, isActive, onClick }) => (
  <motion.button
    onClick={onClick}
    className={`relative flex-1 py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-1.5 ${
      isActive
        ? 'bg-white text-black z-10 shadow-[0_4px_12px_rgba(255,255,255,0.25)]'
        : 'text-white/50 hover:text-white/70'
    }`}
    whileTap={{ scale: 0.95 }}
  >
    {icon}
    {label}
  </motion.button>
);

interface SegmentedControlProps {
  children: React.ReactNode;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({ children }) => (
  <div className="bg-white/5 rounded-full p-1 flex items-center gap-1">
    {children}
  </div>
);

const FilterSheet: React.FC<FilterSheetProps> = ({
  isOpen,
  onClose,
  filters,
  onApply,
}) => {
  // Apply filter changes immediately
  const updateFilter = <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => {
    onApply({ ...filters, [key]: value });
  };

  const handleReset = () => {
    onApply(defaultFilters);
  };

  const activeFilterCount = [
    filters.status !== 'all',
    filters.source !== 'all',
    filters.duration !== 'any',
    filters.deadline !== 'any',
  ].filter(Boolean).length;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} className="bg-black">
      {/* Header */}
      <div className="px-6 pt-2 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white text-xl font-bold">Filter</h2>
          {activeFilterCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-white text-black text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <motion.button
            onClick={handleReset}
            className="px-4 py-2 rounded-full border border-white/20 text-white/70 text-sm font-medium hover:bg-white/5 transition-colors"
            whileTap={{ scale: 0.95 }}
          >
            Reset filters
          </motion.button>
        )}
      </div>

      {/* Filter Sections */}
      <div className="px-6 py-2 pb-24 space-y-6 max-h-[60vh] overflow-y-auto">
        {/* Status */}
        <div className="space-y-3">
          <h3 className="text-white font-medium text-sm">Status</h3>
          <SegmentedControl>
            <SegmentedOption
              label="All"
              isActive={filters.status === 'all'}
              onClick={() => updateFilter('status', 'all')}
            />
            <SegmentedOption
              label="Not Started"
              isActive={filters.status === 'not-started'}
              onClick={() => updateFilter('status', 'not-started')}
            />
            <SegmentedOption
              label="In Progress"
              isActive={filters.status === 'in-progress'}
              onClick={() => updateFilter('status', 'in-progress')}
            />
            <SegmentedOption
              label="Completed"
              isActive={filters.status === 'completed'}
              onClick={() => updateFilter('status', 'completed')}
            />
          </SegmentedControl>
        </div>

        {/* Source */}
        <div className="space-y-3">
          <h3 className="text-white font-medium text-sm">Source</h3>
          <SegmentedControl>
            <SegmentedOption
              label="All"
              isActive={filters.source === 'all'}
              onClick={() => updateFilter('source', 'all')}
            />
            <SegmentedOption
              icon={<Building2 size={14} />}
              label="Organization"
              isActive={filters.source === 'organization'}
              onClick={() => updateFilter('source', 'organization')}
            />
            <SegmentedOption
              icon={<Sparkles size={14} />}
              label="Dicode"
              isActive={filters.source === 'dicode'}
              onClick={() => updateFilter('source', 'dicode')}
            />
          </SegmentedControl>
        </div>

        {/* Duration */}
        <div className="space-y-3">
          <h3 className="text-white font-medium text-sm">Duration</h3>
          <SegmentedControl>
            <SegmentedOption
              label="Any"
              isActive={filters.duration === 'any'}
              onClick={() => updateFilter('duration', 'any')}
            />
            <SegmentedOption
              icon={<Clock size={14} />}
              label="< 30m"
              isActive={filters.duration === 'under30'}
              onClick={() => updateFilter('duration', 'under30')}
            />
            <SegmentedOption
              label="30-60m"
              isActive={filters.duration === '30to60'}
              onClick={() => updateFilter('duration', '30to60')}
            />
            <SegmentedOption
              label="> 1hr"
              isActive={filters.duration === 'over60'}
              onClick={() => updateFilter('duration', 'over60')}
            />
          </SegmentedControl>
        </div>

        {/* Deadline */}
        <div className="space-y-3">
          <h3 className="text-white font-medium text-sm">Deadline</h3>
          <SegmentedControl>
            <SegmentedOption
              label="Any"
              isActive={filters.deadline === 'any'}
              onClick={() => updateFilter('deadline', 'any')}
            />
            <SegmentedOption
              icon={<CalendarCheck size={14} />}
              label="Has"
              isActive={filters.deadline === 'has-deadline'}
              onClick={() => updateFilter('deadline', 'has-deadline')}
            />
            <SegmentedOption
              icon={<CalendarX size={14} />}
              label="None"
              isActive={filters.deadline === 'no-deadline'}
              onClick={() => updateFilter('deadline', 'no-deadline')}
            />
            <SegmentedOption
              icon={<CalendarClock size={14} />}
              label="This Week"
              isActive={filters.deadline === 'due-this-week'}
              onClick={() => updateFilter('deadline', 'due-this-week')}
            />
          </SegmentedControl>
        </div>
      </div>
    </BottomSheet>
  );
};

export default FilterSheet;
