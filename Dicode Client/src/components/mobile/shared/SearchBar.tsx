import React, { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onFilterClick?: () => void;
  recentSearches?: string[];
  onRecentClick?: (search: string) => void;
  showRecent?: boolean;
  className?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search courses',
  value,
  onChange,
  onFilterClick,
  recentSearches = [],
  onRecentClick,
  showRecent = true,
  className = '',
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search input */}
      <div className="relative">
        <div
          className={`flex items-center gap-3 bg-white rounded-2xl border ${
            isFocused ? 'border-course-blue ring-2 ring-course-blue/20' : 'border-light-border'
          } px-4 py-3.5 shadow-soft transition-all`}
        >
          <Search size={20} className="text-light-text-muted flex-shrink-0" />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-light-text placeholder:text-light-text-muted text-base outline-none"
          />
          
          {value && (
            <button
              onClick={() => onChange('')}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-light-bg hover:bg-light-border transition-colors"
            >
              <X size={14} className="text-light-text-muted" />
            </button>
          )}

          {onFilterClick && (
            <button
              onClick={onFilterClick}
              className="w-10 h-10 -mr-2 flex items-center justify-center rounded-xl hover:bg-light-bg transition-colors"
            >
              <SlidersHorizontal size={20} className="text-light-text-secondary" />
            </button>
          )}
        </div>
      </div>

      {/* Recent searches */}
      <AnimatePresence>
        {showRecent && recentSearches.length > 0 && !value && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 flex-wrap"
          >
            <span className="text-light-text-muted text-sm">Recent</span>
            {recentSearches.map((search) => (
              <button
                key={search}
                onClick={() => onRecentClick?.(search)}
                className="px-3 py-1.5 rounded-full bg-white border border-light-border text-light-text-secondary text-sm hover:border-course-blue hover:text-course-blue transition-colors shadow-soft"
              >
                {search}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchBar;
