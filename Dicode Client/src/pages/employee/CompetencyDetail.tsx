import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, BookOpen, Check, Clock, ChevronRight, Inbox, LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getPublishedCampaigns, getVideo } from '@/lib/firestore';
import { useUserEnrollmentsRealtime } from '@/hooks/useEnrollmentRealtime';
import { getDescriptionByName } from '@/lib/competencies';
import { DesktopLayout } from '@/components/desktop';
import AICopilot from '@/components/shared/AICopilot';
import type { Campaign, CampaignEnrollment } from '@/types';

type ViewMode = 'grid' | 'list';
type StatusFilter = 'all' | 'not-started' | 'in-progress' | 'completed';
type SortOption = 'title' | 'duration' | 'progress';

// Scroll threshold for collapsing the large title
const SCROLL_THRESHOLD = 60;

// Background colors for campaign thumbnails
const thumbnailColors = [
  'bg-gradient-to-br from-violet-500 to-purple-600',
  'bg-gradient-to-br from-blue-500 to-cyan-600',
  'bg-gradient-to-br from-emerald-500 to-teal-600',
  'bg-gradient-to-br from-orange-500 to-amber-600',
  'bg-gradient-to-br from-pink-500 to-rose-600',
  'bg-gradient-to-br from-indigo-500 to-blue-600',
];

interface CampaignWithProgress {
  campaign: Campaign;
  enrollment: CampaignEnrollment | null;
  status: 'not-started' | 'in-progress' | 'completed';
  progress: number;
  totalLessons: number;
  thumbnailUrl?: string;
  durationMinutes: number;
}

const CompetencyDetail: React.FC = () => {
  const { competencyName } = useParams<{ competencyName: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const decodedName = decodeURIComponent(competencyName || '');

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  // Desktop view controls (synced with URL)
  const viewModeParam = searchParams.get('view') as ViewMode | null;
  const statusFilterParam = searchParams.get('status') as StatusFilter | null;
  const sortByParam = searchParams.get('sort') as SortOption | null;

  const [viewMode, setViewModeInternal] = useState<ViewMode>(viewModeParam || 'grid');
  const [statusFilter, setStatusFilterInternal] = useState<StatusFilter>(statusFilterParam || 'all');
  const [sortBy, setSortByInternal] = useState<SortOption>(sortByParam || 'title');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Sync URL when view mode changes
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeInternal(mode);
    const newParams = new URLSearchParams(searchParams);
    if (mode !== 'grid') {
      newParams.set('view', mode);
    } else {
      newParams.delete('view');
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Sync URL when status filter changes
  const setStatusFilter = useCallback((status: StatusFilter) => {
    setStatusFilterInternal(status);
    const newParams = new URLSearchParams(searchParams);
    if (status !== 'all') {
      newParams.set('status', status);
    } else {
      newParams.delete('status');
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Sync URL when sort changes
  const setSortBy = useCallback((sort: SortOption) => {
    setSortByInternal(sort);
    const newParams = new URLSearchParams(searchParams);
    if (sort !== 'title') {
      newParams.set('sort', sort);
    } else {
      newParams.delete('sort');
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Sync state when URL changes (e.g., back button, direct link)
  useEffect(() => {
    const viewParam = searchParams.get('view') as ViewMode | null;
    const statusParam = searchParams.get('status') as StatusFilter | null;
    const sortParam = searchParams.get('sort') as SortOption | null;

    if (viewParam && viewParam !== viewMode) {
      setViewModeInternal(viewParam);
    }
    if (statusParam && statusParam !== statusFilter) {
      setStatusFilterInternal(statusParam);
    }
    if (sortParam && sortParam !== sortBy) {
      setSortByInternal(sortParam);
    }
  }, [searchParams, viewMode, statusFilter, sortBy]);

  // Scroll tracking for collapsible header
  const { scrollY } = useScroll();

  // Transform values for header title fade-in
  const headerTitleOpacity = useTransform(scrollY, [0, SCROLL_THRESHOLD], [0, 1]);

  const { enrollments, isLoading: isLoadingEnrollments } = useUserEnrollmentsRealtime(user?.id || '');

  // Load campaigns
  useEffect(() => {
    const loadCampaigns = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const data = await getPublishedCampaigns(
          user.organization,
          user.department,
          user.id,
          user.cohortIds
        );
        setCampaigns(data);
      } catch (error) {
        console.error('Failed to load campaigns:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadCampaigns();
  }, [user]);

  // Fetch thumbnails only (durations come from metadata.computed)
  useEffect(() => {
    const fetchThumbnails = async () => {
      const newThumbnails: Record<string, string> = {};

      for (const campaign of campaigns) {
        const firstItem = campaign.items?.[0];
        if (firstItem?.videoId) {
          try {
            const video = await getVideo(firstItem.videoId);
            if (video?.thumbnailUrl) {
              newThumbnails[campaign.id] = video.thumbnailUrl;
            }
          } catch {
            // Silent fail
          }
        }
      }

      setThumbnails(newThumbnails);
    };

    if (campaigns.length > 0) {
      fetchThumbnails();
    }
  }, [campaigns]);

  // Filter campaigns by competency and add progress
  const filteredCampaigns = useMemo((): CampaignWithProgress[] => {
    return campaigns
      .filter(campaign => {
        const tags = campaign.metadata?.tags || [];
        const skillFocus = campaign.skillFocus || '';
        return tags.includes(decodedName) || skillFocus === decodedName;
      })
      .map(campaign => {
        const enrollment = enrollments.find(e => e.campaignId === campaign.id) || null;
        const totalLessons = campaign.metadata.computed?.totalItems ?? campaign.items?.length ?? 0;

        let status: 'not-started' | 'in-progress' | 'completed' = 'not-started';
        let progress = 0;

        if (enrollment) {
          const completedModules =
            enrollment.completedModules ??
            Object.values(enrollment.moduleProgress || {}).filter((m) => m.completed).length;

          progress = totalLessons > 0 ? Math.round((completedModules / totalLessons) * 100) : 0;

          if (enrollment.status === 'completed' || (totalLessons > 0 && progress === 100)) {
            status = 'completed';
            progress = 100;
          } else if (enrollment.status === 'in-progress' || completedModules > 0) {
            status = 'in-progress';
          }
        }

        return {
          campaign,
          enrollment,
          status,
          progress,
          totalLessons,
          thumbnailUrl: thumbnails[campaign.id],
          durationMinutes: campaign.metadata.computed?.estimatedMinutes ?? 0,
        };
      });
  }, [campaigns, enrollments, thumbnails, decodedName]);

  // Desktop: filtered and sorted campaigns
  const displayedCampaigns = useMemo(() => {
    let result = [...filteredCampaigns];

    // Apply status filter
    const currentStatusFilter = statusFilterParam || statusFilter;
    if (currentStatusFilter !== 'all') {
      result = result.filter(item => item.status === currentStatusFilter);
    }

    // Apply sorting
    const currentSortBy = sortByParam || sortBy;
    result.sort((a, b) => {
      switch (currentSortBy) {
        case 'title':
          return a.campaign.title.localeCompare(b.campaign.title);
        case 'duration':
          return b.durationMinutes - a.durationMinutes;
        case 'progress':
          return b.progress - a.progress;
        default:
          return 0;
      }
    });

    return result;
  }, [filteredCampaigns, statusFilter, statusFilterParam, sortBy, sortByParam]);

  const loading = isLoading || isLoadingEnrollments;

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    const currentStatusFilter = statusFilterParam || statusFilter;
    const currentSortBy = sortByParam || sortBy;
    if (currentStatusFilter !== 'all') count++;
    if (currentSortBy !== 'title') count++;
    return count;
  }, [statusFilter, statusFilterParam, sortBy, sortByParam]);

  // Reset all filters
  const resetFilters = () => {
    setStatusFilter('all');
    setSortBy('title');
  };

  // Status filter options
  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'not-started', label: 'Not Started' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ];

  // Sort options
  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'title', label: 'Title' },
    { value: 'duration', label: 'Duration' },
    { value: 'progress', label: 'Progress' },
  ];

  // Desktop view renderer
  const renderDesktopView = () => {
    return (
      <DesktopLayout
        activePage="learn"
        title={decodedName}
        breadcrumbs={[
          { label: 'Learn', path: '/employee/learn', icon: BookOpen },
          { label: decodedName }
        ]}
        onAICopilotClick={() => setIsCopilotOpen(true)}
      >
        <div className="flex-1 overflow-auto p-6 relative">
          {/* Controls - Top Right Corner */}
          <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
            {/* Filters Button */}
            <button
              onClick={() => setIsFilterPanelOpen(true)}
              className={`relative p-2 rounded-lg transition-all ${activeFilterCount > 0
                ? 'text-blue-400'
                : 'text-white/70 hover:text-white'
                }`}
            >
              <SlidersHorizontal size={20} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                  }`}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                  }`}
              >
                <List size={18} />
              </button>
            </div>
          </div>

          <div className="max-w-5xl mx-auto">
            {/* Header Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <h1 className="text-3xl font-bold text-white mb-2">{decodedName}</h1>
              <p className="text-white/50">
                {filteredCampaigns.length} {filteredCampaigns.length === 1 ? 'campaign' : 'campaigns'}
              </p>
              {getDescriptionByName(decodedName) && (
                <p className="text-white/60 mt-4 max-w-2xl leading-relaxed">
                  {getDescriptionByName(decodedName)}
                </p>
              )}
            </motion.div>

            {/* Results count when filtered */}
            {(statusFilterParam || statusFilter) !== 'all' && (
              <p className="text-white/40 text-sm mb-4">
                Showing {displayedCampaigns.length} of {filteredCampaigns.length} campaigns
              </p>
            )}

            {/* Campaigns */}
            {loading ? (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i}>
                      <div className="w-full aspect-video rounded-lg bg-white/10 animate-pulse mb-2" />
                      <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse mb-1" />
                      <div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-[#1a1a1a] rounded-2xl p-4 h-20 animate-pulse" />
                  ))}
                </div>
              )
            ) : displayedCampaigns.length === 0 ? (
              <motion.div
                className="text-center py-20"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                  <Inbox size={36} className="text-white/40" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {filteredCampaigns.length === 0 ? 'No campaigns found' : 'No matching campaigns'}
                </h3>
                <p className="text-white/50 max-w-md mx-auto">
                  {filteredCampaigns.length === 0
                    ? `There are no campaigns tagged with "${decodedName}" at the moment.`
                    : 'Try adjusting your filters to see more results.'}
                </p>
                {(statusFilterParam || statusFilter) !== 'all' && (
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </motion.div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
                {displayedCampaigns.map((item, index) => (
                  <motion.button
                    key={item.campaign.id}
                    onClick={() => navigate(`/employee/campaign/${item.campaign.id}`)}
                    className="text-left group"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    {/* Thumbnail */}
                    <div className={`relative w-full aspect-video rounded-lg ${thumbnailColors[index % thumbnailColors.length]} mb-2 overflow-hidden flex items-center justify-center group-hover:ring-2 group-hover:ring-white/20 transition-all`}>
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <BookOpen size={24} className="text-white/60" />
                      )}
                      {/* Progress bar for in-progress */}
                      {item.status === 'in-progress' && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                          <div className="h-full bg-blue-500" style={{ width: `${item.progress}%` }} />
                        </div>
                      )}
                      {/* Completed overlay */}
                      {item.status === 'completed' && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check size={16} className="text-white" strokeWidth={3} />
                          </div>
                        </div>
                      )}
                      {/* Duration badge */}
                      {item.durationMinutes > 0 && item.status !== 'completed' && (
                        <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                          {item.durationMinutes} min
                        </div>
                      )}
                    </div>
                    {/* Title */}
                    <h3 className="text-white text-sm font-medium line-clamp-2 leading-tight mb-1 group-hover:text-white/90">
                      {item.campaign.title}
                    </h3>
                    {/* Subtitle */}
                    <p className="text-white/40 text-xs">
                      {item.status === 'in-progress' ? (
                        `${item.progress}% complete`
                      ) : item.status === 'completed' ? (
                        'Completed'
                      ) : (
                        `${item.totalLessons} lessons`
                      )}
                    </p>
                  </motion.button>
                ))}
              </div>
            ) : (
              /* List View - YouTube Style */
              <div className="space-y-4">
                {displayedCampaigns.map((item, index) => (
                  <motion.button
                    key={item.campaign.id}
                    onClick={() => navigate(`/employee/campaign/${item.campaign.id}`)}
                    className="w-full flex gap-4 text-left group"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                  >
                    {/* Thumbnail - YouTube style aspect-video */}
                    <div className={`relative w-64 flex-shrink-0 aspect-video rounded-xl ${thumbnailColors[index % thumbnailColors.length]} overflow-hidden flex items-center justify-center group-hover:ring-2 group-hover:ring-white/20 transition-all`}>
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <BookOpen size={32} className="text-white/60" />
                      )}
                      {/* Progress bar for in-progress */}
                      {item.status === 'in-progress' && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                          <div className="h-full bg-blue-500" style={{ width: `${item.progress}%` }} />
                        </div>
                      )}
                      {/* Completed overlay */}
                      {item.status === 'completed' && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check size={20} className="text-white" strokeWidth={3} />
                          </div>
                        </div>
                      )}
                      {/* Duration badge */}
                      {item.durationMinutes > 0 && item.status !== 'completed' && (
                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                          {item.durationMinutes} min
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 py-1">
                      <h3 className="text-white font-medium text-base line-clamp-2 leading-snug mb-2 group-hover:text-blue-400 transition-colors">
                        {item.campaign.title}
                      </h3>
                      <p className="text-white/50 text-sm flex items-center gap-2">
                        <span>{item.totalLessons} lessons</span>
                        {item.status === 'in-progress' && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-white/30" />
                            <span className="text-blue-400">{item.progress}% complete</span>
                          </>
                        )}
                        {item.status === 'completed' && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-white/30" />
                            <span className="text-emerald-400">Completed</span>
                          </>
                        )}
                      </p>
                      {/* Tags */}
                      {item.campaign.metadata?.tags && item.campaign.metadata.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-3">
                          {item.campaign.metadata.tags.slice(0, 3).map((tag: string) => (
                            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filter Panel - Slide from right */}
        <AnimatePresence>
          {isFilterPanelOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsFilterPanelOpen(false)}
                className="fixed inset-0 bg-black/50 z-40"
              />

              {/* Panel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-80 bg-[#111] border-l border-white/10 z-50 flex flex-col"
              >
                {/* Header */}
                <div className="p-4 border-b border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-white font-semibold text-lg">Filters & Sort</h2>
                    <button
                      onClick={() => setIsFilterPanelOpen(false)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X size={20} className="text-white/70" />
                    </button>
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => {
                        resetFilters();
                      }}
                      className="w-full py-2.5 rounded-lg text-white/70 hover:bg-white/10 text-sm font-medium transition-colors border border-white/10"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Filter Sections */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* Status Section */}
                  <div>
                    <h3 className="text-white/50 text-xs uppercase tracking-wider font-medium mb-3">Status</h3>
                    <div className="space-y-2">
                      {statusOptions.map((option) => {
                        const currentStatusFilter = statusFilterParam || statusFilter;
                        return (
                          <button
                            key={option.value}
                            onClick={() => setStatusFilter(option.value)}
                            className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${currentStatusFilter === option.value
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-white/5 text-white/70 hover:bg-white/10 border border-transparent'
                              }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sort Section */}
                  <div>
                    <h3 className="text-white/50 text-xs uppercase tracking-wider font-medium mb-3">Sort By</h3>
                    <div className="space-y-2">
                      {sortOptions.map((option) => {
                        const currentSortBy = sortByParam || sortBy;
                        return (
                          <button
                            key={option.value}
                            onClick={() => setSortBy(option.value)}
                            className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${currentSortBy === option.value
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-white/5 text-white/70 hover:bg-white/10 border border-transparent'
                              }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10">
                  <button
                    onClick={() => setIsFilterPanelOpen(false)}
                    className="w-full py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        {isCopilotOpen && (
          <AICopilot
            isOpen={isCopilotOpen}
            onClose={() => setIsCopilotOpen(false)}
            context={{ userRole: 'employee' }}
          />
        )}
      </DesktopLayout>
    );
  };

  return (
    <>
      {/* Desktop View */}
      <div className="hidden lg:block">
        {renderDesktopView()}
      </div>

      {/* Mobile View */}
      <div className="min-h-screen lg:hidden pb-24 bg-gradient-to-b from-black via-black/80 to-transparent">
        {/* Header */}
        <header className="sticky top-0 z-40">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" />
          <div className="relative flex items-center gap-4 px-4 py-4">
            <motion.button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft size={20} className="text-white" />
            </motion.button>

            <div className="flex-1 min-w-0">
              {/* Header title - fades in as user scrolls */}
              <motion.h1
                className="text-white text-lg font-bold truncate"
                style={{ opacity: headerTitleOpacity }}
              >
                {decodedName}
              </motion.h1>
              <motion.p
                className="text-white/50 text-sm"
                style={{ opacity: headerTitleOpacity }}
              >
                {filteredCampaigns.length} {filteredCampaigns.length === 1 ? 'campaign' : 'campaigns'}
              </motion.p>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="px-4 py-4">
          {/* Large Title Section - scrolls naturally, header title fades in as this scrolls out */}
          <div className="mb-4 pr-8">
            <h1 className="text-white text-3xl font-bold mb-2 leading-tight">{decodedName}</h1>
            <p className="text-white/50 text-sm">
              {filteredCampaigns.length} {filteredCampaigns.length === 1 ? 'campaign' : 'campaigns'}
            </p>
          </div>

          {/* Description */}
          {getDescriptionByName(decodedName) && (
            <motion.p
              className="text-white/60 text-sm mb-6 leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {getDescriptionByName(decodedName)}
            </motion.p>
          )}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-[#1a1a1a] rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white/10 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <motion.div
              className="text-center py-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                <Inbox size={28} className="text-white/40" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">No campaigns found</h3>
              <p className="text-sm text-white/50 max-w-[240px] mx-auto">
                There are no campaigns tagged with "{decodedName}" at the moment.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {filteredCampaigns.map((item, index) => (
                <motion.button
                  key={item.campaign.id}
                  onClick={() => navigate(`/employee/campaign/${item.campaign.id}`)}
                  className="w-full bg-[#1a1a1a] rounded-2xl p-4 flex items-center gap-4 text-left"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Thumbnail */}
                  <div className={`w-14 h-14 rounded-xl ${thumbnailColors[index % thumbnailColors.length]} flex-shrink-0 overflow-hidden flex items-center justify-center`}>
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen size={24} className="text-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold text-[15px] truncate">
                        {item.campaign.title}
                      </h3>
                      {item.status === 'completed' && (
                        <div
                          className="w-5 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0"
                          style={{ boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)' }}
                        >
                          <Check size={12} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <p className="text-white/50 text-sm truncate flex items-center gap-2">
                      <span>
                        {item.status === 'in-progress' ? (
                          `${item.progress}% complete`
                        ) : item.status === 'completed' ? (
                          'Completed'
                        ) : (
                          `${item.totalLessons} lessons`
                        )}
                      </span>
                      {item.durationMinutes > 0 && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {item.durationMinutes} min
                          </span>
                        </>
                      )}
                    </p>
                    {item.status === 'in-progress' && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-blue-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${item.progress}%` }}
                            transition={{ duration: 0.5, delay: index * 0.05 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <ChevronRight size={20} className="text-white/30 flex-shrink-0" />
                </motion.button>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default CompetencyDetail;
