import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, BookOpen, Check, Maximize2 } from 'lucide-react';
import { useGlobalSearch, CampaignWithProgress } from '@/contexts/GlobalSearchContext';

// Tag colors for recent searches
const tagColors = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
];

// Background colors for campaign thumbnails
const thumbnailColors = [
  'bg-gradient-to-br from-violet-500 to-purple-600',
  'bg-gradient-to-br from-blue-500 to-cyan-600',
  'bg-gradient-to-br from-emerald-500 to-teal-600',
  'bg-gradient-to-br from-orange-500 to-amber-600',
  'bg-gradient-to-br from-pink-500 to-rose-600',
  'bg-gradient-to-br from-indigo-500 to-blue-600',
];

export const GlobalSearchOverlay: React.FC = () => {
  const navigate = useNavigate();
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [expandedChip, setExpandedChip] = useState<string | null>(null);

  const {
    isSearchOpen,
    searchQuery,
    setSearchQuery,
    closeSearch,
    recentSearches,
    saveRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    filteredCampaigns,
    isLoading,
  } = useGlobalSearch();

  // Focus input when overlay opens
  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchOpen) {
        closeSearch();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSearchOpen, closeSearch]);

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      closeSearch();
    }
  };

  const handleCampaignClick = (campaignId: string) => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim());
    }
    closeSearch();
    navigate(`/employee/campaign/${campaignId}`);
  };

  const handleRecentSearchClick = (term: string) => {
    setSearchQuery(term);
  };

  const handleExpandSearch = () => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim());
    }
    closeSearch();
    navigate(`/employee/learn?search=${encodeURIComponent(searchQuery)}`);
  };

  if (!isSearchOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleBackdropClick}
      >
        <motion.div
          className="w-full max-w-3xl mx-auto mt-20"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Search Input */}
          <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
              <Search size={20} className="text-white/40 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search campaigns..."
                className="flex-1 bg-transparent text-white text-lg placeholder:text-white/40 outline-none"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={18} className="text-white/50" />
                </button>
              )}
              {searchQuery.trim() && (
                <button
                  onClick={handleExpandSearch}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                  title="Expand to full search"
                >
                  <Maximize2 size={14} />
                  <span>Expand</span>
                </button>
              )}
              <button
                onClick={closeSearch}
                className="hover:bg-white/5 rounded-lg p-1 transition-colors"
              >
                <kbd className="px-2 py-1 text-xs text-white/40 bg-white/10 rounded border border-white/10 font-sans">
                  ESC
                </kbd>
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto">
              {/* Recent Searches - show when no query */}
              {!searchQuery.trim() && recentSearches.length > 0 && (
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/50 text-sm font-medium">Recent searches</span>
                    <button
                      onClick={clearRecentSearches}
                      className="text-white/30 text-sm hover:text-white/50 transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term, index) => {
                      const isExpanded = expandedChip === term;
                      return (
                        <button
                          key={term}
                          onClick={() => handleRecentSearchClick(term)}
                          onMouseEnter={() => setExpandedChip(term)}
                          onMouseLeave={() => setExpandedChip(null)}
                          className={`flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all ${tagColors[index % tagColors.length]}`}
                        >
                          <span>{term}</span>
                          <div
                            className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'w-5 ml-1.5' : 'w-0'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRecentSearch(term);
                            }}
                          >
                            <X size={14} className="cursor-pointer" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state - no query and no recent searches */}
              {!searchQuery.trim() && recentSearches.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <Search size={40} className="text-white/20 mx-auto mb-3" />
                  <p className="text-white/40">Start typing to search campaigns</p>
                </div>
              )}

              {/* Search Results */}
              {searchQuery.trim() && (
                <div className="px-5 py-4">
                  {isLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex gap-4 animate-pulse">
                          <div className="w-32 aspect-video bg-white/10 rounded-lg" />
                          <div className="flex-1 space-y-2 py-1">
                            <div className="h-4 w-3/4 bg-white/10 rounded" />
                            <div className="h-3 w-1/2 bg-white/10 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredCampaigns.length > 0 ? (
                    <>
                      <p className="text-white/50 text-sm mb-4">
                        {filteredCampaigns.length} {filteredCampaigns.length === 1 ? 'result' : 'results'}
                      </p>
                      <div className="space-y-3">
                        {filteredCampaigns.map((item, index) => (
                          <SearchResultItem
                            key={item.campaign.id}
                            item={item}
                            index={index}
                            onClick={() => handleCampaignClick(item.campaign.id)}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="py-12 text-center">
                      <Search size={40} className="text-white/20 mx-auto mb-3" />
                      <p className="text-white/50">No campaigns found for "{searchQuery}"</p>
                      <p className="text-white/30 text-sm mt-1">Try a different search term</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Search result item component
const SearchResultItem: React.FC<{
  item: CampaignWithProgress;
  index: number;
  onClick: () => void;
}> = ({ item, index, onClick }) => {
  return (
    <motion.button
      onClick={onClick}
      className="w-full flex gap-4 text-left group p-2 -mx-2 rounded-xl hover:bg-white/5 transition-colors"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      {/* Thumbnail */}
      <div className={`relative w-32 flex-shrink-0 aspect-video rounded-lg ${thumbnailColors[index % thumbnailColors.length]} overflow-hidden flex items-center justify-center`}>
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <BookOpen size={24} className="text-white/60" />
        )}
        {item.status === 'completed' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check size={16} className="text-white" strokeWidth={3} />
            </div>
          </div>
        )}
        {item.status === 'in-progress' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-blue-500" style={{ width: `${item.progress}%` }} />
          </div>
        )}
        {/* Duration badge */}
        {item.durationMinutes > 0 && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded">
            {item.durationMinutes} min
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <h3 className="text-white font-medium text-sm line-clamp-2 leading-snug mb-1.5 group-hover:text-blue-400 transition-colors">
          {item.campaign.title}
        </h3>
        <p className="text-white/40 text-xs flex items-center gap-2">
          <span>{item.totalLessons} lessons</span>
          {item.status === 'in-progress' && (
            <>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>{item.progress}% complete</span>
            </>
          )}
          {item.status === 'completed' && (
            <>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-emerald-400">Completed</span>
            </>
          )}
        </p>
        {/* Tags */}
        {item.campaign.metadata?.tags && item.campaign.metadata.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            {item.campaign.metadata.tags.slice(0, 2).map((tag: string) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.button>
  );
};

export default GlobalSearchOverlay;
