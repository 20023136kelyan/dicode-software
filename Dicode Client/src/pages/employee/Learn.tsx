import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, SlidersHorizontal, ChevronRight, Heart, MoreVertical, BookOpen, Check, Clock, X, ArrowUpRight, Flame, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Avatar,
  StreakInline,
  NotificationsSheet,
} from '@/components/mobile';
import { DesktopLayout } from '@/components/desktop';
import AICopilot from '@/components/shared/AICopilot';
import FilterSheet, { FilterOptions, defaultFilters } from '@/components/mobile/FilterSheet';
import { getPublishedCampaigns, getVideo, getOrganization } from '@/lib/firestore';
import { useUserEnrollmentsRealtime } from '@/hooks/useEnrollmentRealtime';
import { useUserStatsWithFallback } from '@/hooks/useUserStats';
import { useEmployeeNotifications, convertToUINotification } from '@/hooks/useEmployeeNotifications';
import { COMPETENCIES } from '@/lib/competencies';
import type { Campaign, CampaignEnrollment } from '@/types';

// Flatten all skills from competencies with their parent competency info
const ALL_SKILLS = COMPETENCIES.flatMap(comp =>
  comp.skills.map(skill => ({
    ...skill,
    competencyId: comp.id,
    competencyName: comp.name,
  }))
);

// localStorage key for recent searches
const RECENT_SEARCHES_KEY = 'dicode_recent_searches';
const MAX_RECENT_SEARCHES = 5;

// Tag colors for recent searches (light bg, dark text)
const tagColors = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
];

// Gradient colors for competency cards
const cardGradients = [
  'from-orange-400 to-orange-500',
  'from-blue-400 to-blue-500',
  'from-sky-400 to-sky-500',
  'from-purple-400 to-purple-500',
  'from-pink-400 to-pink-500',
  'from-green-400 to-green-500',
];

// Professional emojis for competencies
const competencyEmojis = [
  '📊', '💡', '🎯', '🧠', '📈', '🤝', '💬', '🏆',
  '⚡', '🔑', '📚', '🎓', '💪', '🌟', '🧭', '🔍',
  '📝', '🎨', '🛠️', '🌱', '🎪', '🧩', '📣', '🔬',
];

// Get consistent emoji for a skill name using hash
const getCompetencyEmoji = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % competencyEmojis.length;
  return competencyEmojis[index];
};

// Background colors for campaign thumbnails
const thumbnailColors = [
  'bg-gradient-to-br from-violet-500 to-purple-600',
  'bg-gradient-to-br from-blue-500 to-cyan-600',
  'bg-gradient-to-br from-emerald-500 to-teal-600',
  'bg-gradient-to-br from-orange-500 to-amber-600',
  'bg-gradient-to-br from-pink-500 to-rose-600',
  'bg-gradient-to-br from-indigo-500 to-blue-600',
];

// Campaign with progress info
interface CampaignWithProgress {
  campaign: Campaign;
  enrollment: CampaignEnrollment | null;
  status: 'not-started' | 'in-progress' | 'completed';
  progress: number;
  totalLessons: number;
  thumbnailUrl?: string;
  nextVideoTitle?: string;
  nextVideoIndex: number;
  durationMinutes: number;
  endDate?: Date | string | number;
}

// Format end date helper
const formatEndDate = (date: Date | string | number | undefined): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays <= 7) return `${diffDays} days left`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const Learn: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // Initialize search from URL params
  const initialSearch = searchParams.get('search') || '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Sync URL params with search query
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams]);

  // Sync URL params with filters (source, status)
  useEffect(() => {
    const sourceParam = searchParams.get('source');
    const statusParam = searchParams.get('status');

    if (sourceParam) {
      const source = sourceParam as 'all' | 'organization' | 'dicode';
      if (['all', 'organization', 'dicode'].includes(source)) {
        setDesktopFilters(prev => ({ ...prev, source }));
        setFilters(prev => ({ ...prev, source }));
      }
    }

    if (statusParam) {
      const status = statusParam as 'all' | 'in-progress' | 'not-started' | 'completed';
      if (['all', 'in-progress', 'not-started', 'completed'].includes(status)) {
        setDesktopFilters(prev => ({ ...prev, status }));
        setFilters(prev => ({ ...prev, status }));
      }
    }
  }, [searchParams]);

  // Update URL when search changes (for desktop expanded search)
  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setSearchParams({ search: query }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [setSearchParams]);
  const [expandedChip, setExpandedChip] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Desktop filter states
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [desktopFilters, setDesktopFilters] = useState({
    status: 'all' as 'all' | 'in-progress' | 'not-started' | 'completed',
    skill: null as string | null,
    source: 'all' as 'all' | 'organization' | 'dicode',
    dueDate: 'all' as 'all' | 'overdue' | 'this-week' | 'this-month' | 'no-deadline',
    createdDate: 'all' as 'all' | 'last-7-days' | 'last-30-days' | 'last-90-days',
    moduleCount: 'all' as 'all' | '1-2' | '3-4' | '5+',
  });

  // Count active filters (excluding 'all' values and null skill)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (desktopFilters.status !== 'all') count++;
    if (desktopFilters.skill !== null) count++;
    if (desktopFilters.source !== 'all') count++;
    if (desktopFilters.dueDate !== 'all') count++;
    if (desktopFilters.createdDate !== 'all') count++;
    if (desktopFilters.moduleCount !== 'all') count++;
    return count;
  }, [desktopFilters]);

  // Reset all filters
  const resetFilters = () => {
    setDesktopFilters({
      status: 'all',
      skill: null,
      source: 'all',
      dueDate: 'all',
      createdDate: 'all',
      moduleCount: 'all',
    });
  };

  // Get real-time notifications
  const {
    notifications: rawNotifications,
    markAsRead,
    markAllAsRead,
  } = useEmployeeNotifications(user?.id || '');

  // Convert to UI format
  const notifications = useMemo(() =>
    rawNotifications.map(convertToUINotification),
    [rawNotifications]
  );
  const [isLoading, setIsLoading] = useState(true);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [organizationName, setOrganizationName] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get enrollments
  const { enrollments, isLoading: isLoadingEnrollments } = useUserEnrollmentsRealtime(user?.id || '');

  // Get server-computed streak data with client fallback
  const { stats: streakStats } = useUserStatsWithFallback(user?.id || '', enrollments);


  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error);
    }
  }, []);

  // Save search to recent searches
  const saveRecentSearch = useCallback((term: string) => {
    if (!term.trim()) return;

    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== term.toLowerCase());
      const updated = [term, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Remove a recent search
  const removeRecentSearch = useCallback((term: string) => {
    setRecentSearches(prev => {
      const updated = prev.filter(s => s !== term);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clear all recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  }, []);

  // Handle search submission (when user presses enter or clicks a result)
  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim());
    }
  }, [searchQuery, saveRecentSearch]);

  // Handle clicking a campaign from search results or grid
  const handleCampaignClick = useCallback((campaignId: string) => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim());
    }
    // Navigate to module player on both desktop and mobile
    navigate(`/employee/module/${campaignId}`);
  }, [searchQuery, saveRecentSearch, navigate]);

  // Fetch organization name
  useEffect(() => {
    const fetchOrgName = async () => {
      if (!user?.organization) return;
      try {
        const org = await getOrganization(user.organization);
        if (org?.name) {
          setOrganizationName(org.name);
        }
      } catch (error) {
        console.error('Failed to fetch organization:', error);
      }
    };
    fetchOrgName();
  }, [user?.organization]);

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
          user.cohortIds,
          user.role
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

  // Fetch thumbnails for campaigns (only first video's thumbnail needed)
  useEffect(() => {
    const fetchThumbnails = async () => {
      const newThumbnails: Record<string, string> = {};

      for (const campaign of campaigns) {
        // Only fetch first video for thumbnail
        const firstItem = campaign.items?.[0];
        if (firstItem?.videoId) {
          try {
            const video = await getVideo(firstItem.videoId);
            if (video?.thumbnailUrl) {
              newThumbnails[campaign.id] = video.thumbnailUrl;
            }
          } catch (error) {
            // Silent fail for video fetch
          }
        }
      }

      setThumbnails(newThumbnails);
    };

    if (campaigns.length > 0) {
      fetchThumbnails();
    }
  }, [campaigns]);

  // Combine campaigns with enrollment data
  const campaignsWithProgress = useMemo((): CampaignWithProgress[] => {
    return campaigns.map(campaign => {
      const enrollment = enrollments.find(e => e.campaignId === campaign.id) || null;
      // Use precomputed totalItems with fallback to items.length
      const totalLessons = campaign.metadata.computed?.totalItems ?? campaign.items?.length ?? 0;

      let status: 'not-started' | 'in-progress' | 'completed' = 'not-started';
      let progress = 0;
      let nextVideoIndex = 0;

      if (enrollment) {
        const moduleProgressMap = enrollment.moduleProgress || {};

        // Count fully completed modules
        const completedModules =
          enrollment.completedModules ??
          Object.values(moduleProgressMap).filter((m) => m.completed).length;

        // Calculate overall progress based on partial module completion (video + questions)
        progress = totalLessons > 0 ? Math.round(
          (campaign.items || []).reduce((sum, item) => {
            const moduleState = moduleProgressMap[item.id];
            if (!moduleState) return sum;

            const questionTarget = moduleState.questionTarget || 3;
            const progressRatio = ((moduleState.videoFinished ? 1 : 0) +
              Math.min(moduleState.questionsAnswered || 0, questionTarget)) /
              (questionTarget + 1);
            return sum + progressRatio;
          }, 0) / totalLessons * 100
        ) : 0;

        // Find first incomplete module for next video index
        const firstIncompleteIndex = (campaign.items || []).findIndex(
          item => !moduleProgressMap[item.id]?.completed
        );
        nextVideoIndex = firstIncompleteIndex === -1 ? totalLessons - 1 : firstIncompleteIndex;

        // Check if has any progress (even partial)
        const hasAnyProgress = progress > 0 || Object.keys(moduleProgressMap).length > 0;

        // Determine status: trust enrollment.status but also check calculated completion
        if (enrollment.status === 'completed' || (totalLessons > 0 && completedModules >= totalLessons)) {
          status = 'completed';
          progress = 100;
        } else if (enrollment.status === 'in-progress' || hasAnyProgress) {
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
        nextVideoIndex,
        // Use precomputed estimatedMinutes with fallback
        durationMinutes: campaign.metadata.computed?.estimatedMinutes ?? 0,
        endDate: campaign.schedule?.endDate,
      };
    });
  }, [campaigns, enrollments, thumbnails]);

  // Apply filters helper
  const applyFilters = (items: CampaignWithProgress[]): CampaignWithProgress[] => {
    return items.filter(item => {
      // Status filter
      if (filters.status !== 'all' && item.status !== filters.status) {
        return false;
      }

      // Source filter
      if (filters.source !== 'all') {
        const isOrg = item.campaign.source === 'organization';
        if (filters.source === 'organization' && !isOrg) return false;
        if (filters.source === 'dicode' && isOrg) return false;
      }

      // Duration filter
      if (filters.duration !== 'any') {
        const duration = item.durationMinutes;
        if (filters.duration === 'under30' && duration >= 30) return false;
        if (filters.duration === '30to60' && (duration < 30 || duration > 60)) return false;
        if (filters.duration === 'over60' && duration <= 60) return false;
      }

      // Deadline filter
      if (filters.deadline !== 'any') {
        const hasDeadline = !!item.endDate;
        if (filters.deadline === 'has-deadline' && !hasDeadline) return false;
        if (filters.deadline === 'no-deadline' && hasDeadline) return false;
        if (filters.deadline === 'due-this-week') {
          // Must have a deadline to be "due this week"
          if (!hasDeadline) return false;
          const deadline = new Date(item.endDate as string | number | Date);
          const now = new Date();
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          if (deadline > weekFromNow || deadline < now) return false;
        }
      }

      return true;
    });
  };

  // Filter campaigns by search query and filters
  const filteredCampaigns = useMemo(() => {
    let results = campaignsWithProgress;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(item =>
        item.campaign.title.toLowerCase().includes(query) ||
        item.campaign.skillFocus?.toLowerCase().includes(query) ||
        item.campaign.metadata?.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply other filters
    return applyFilters(results);
  }, [campaignsWithProgress, searchQuery, filters]);

  // Segment campaigns by status
  const ongoingCampaigns = useMemo(() =>
    filteredCampaigns.filter(c => c.status === 'in-progress'),
    [filteredCampaigns]
  );

  // Not started campaigns split by source
  const organizationCampaigns = useMemo(() =>
    filteredCampaigns.filter(c => c.status === 'not-started' && c.campaign.source === 'organization'),
    [filteredCampaigns]
  );

  const dicodeCampaigns = useMemo(() =>
    filteredCampaigns.filter(c => c.status === 'not-started' && c.campaign.source !== 'organization'),
    [filteredCampaigns]
  );

  const completedCampaigns = useMemo(() =>
    filteredCampaigns.filter(c => c.status === 'completed'),
    [filteredCampaigns]
  );

  // Count active filters (mobile)
  const mobileActiveFilterCount = useMemo(() => {
    return [
      filters.status !== 'all',
      filters.source !== 'all',
      filters.duration !== 'any',
      filters.deadline !== 'any',
    ].filter(Boolean).length;
  }, [filters]);

  // Extract competencies with campaign counts and relevance scoring
  const competencies = useMemo(() => {
    // Build a set of started/completed campaign IDs
    const startedCampaignIds = new Set(enrollments.map(e => e.campaignId));

    const skillMap = new Map<string, { campaignIds: Set<string>; notStartedCount: number }>();

    campaigns.forEach(campaign => {
      // Use metadata.tags if available, otherwise fallback to skillFocus
      const campaignCompetencies = campaign.metadata?.tags?.length
        ? campaign.metadata.tags
        : campaign.skillFocus
          ? [campaign.skillFocus]
          : [];

      const isNotStarted = !startedCampaignIds.has(campaign.id);

      campaignCompetencies.forEach(competency => {
        if (competency) {
          if (!skillMap.has(competency)) {
            skillMap.set(competency, { campaignIds: new Set(), notStartedCount: 0 });
          }
          const data = skillMap.get(competency)!;
          data.campaignIds.add(campaign.id);
          if (isNotStarted) {
            data.notStartedCount++;
          }
        }
      });
    });

    return Array.from(skillMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.campaignIds.size,
        notStartedCount: data.notStartedCount,
      }))
      // Sort: prioritize competencies with not-started campaigns, then by total count
      .sort((a, b) => {
        // First: competencies with more not-started campaigns come first
        if (a.notStartedCount !== b.notStartedCount) {
          return b.notStartedCount - a.notStartedCount;
        }
        // Then: by total campaign count
        return b.count - a.count;
      });
  }, [campaigns, enrollments]);

  const handleCompetencyClick = (competencyName: string) => {
    navigate(`/employee/learn/competency/${encodeURIComponent(competencyName)}`);
  };

  // Desktop view renderer
  const renderDesktopView = () => {
    const breadcrumbs = [{ label: 'Learn', icon: BookOpen }];

    return (
      <DesktopLayout
        activePage="learn"
        title="Learn"
        breadcrumbs={breadcrumbs}
        searchValue={searchQuery}
        onSearchChange={updateSearchQuery}
        onAICopilotClick={() => setIsCopilotOpen(true)}
      >
        {/* Main Content */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          {searchQuery.trim() ? (
            <div>
              {/* Results Header */}
              <div className="flex items-center justify-between mb-6">
                <p className="text-white/50 text-sm">
                  {filteredCampaigns.length} {filteredCampaigns.length === 1 ? 'result' : 'results'} for "{searchQuery}"
                </p>
                <button
                  onClick={() => updateSearchQuery('')}
                  className="text-sm text-white/50 hover:text-white transition-colors"
                >
                  Clear search
                </button>
              </div>
              {filteredCampaigns.length > 0 ? (
                <div className="space-y-4">
                  {filteredCampaigns.map((item, index) => (
                    <motion.button
                      key={item.campaign.id}
                      onClick={() => handleCampaignClick(item.campaign.id)}
                      className="w-full flex gap-4 text-left group"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      {/* Thumbnail */}
                      <div className={`relative w-64 flex-shrink-0 aspect-video rounded-xl ${thumbnailColors[index % thumbnailColors.length]} overflow-hidden flex items-center justify-center group-hover:ring-2 group-hover:ring-white/20 transition-all`}>
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <BookOpen size={32} className="text-white/60" />
                        )}
                        {item.status === 'completed' && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Check size={20} className="text-white" strokeWidth={3} />
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
                          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                            {item.durationMinutes} min
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 py-1">
                        <h3 className="text-white font-medium text-base line-clamp-2 leading-snug mb-2 group-hover:text-blue-400 transition-colors">
                          {item.campaign.title}
                        </h3>
                        <p className="text-white/40 text-xs mb-2">
                          {item.totalLessons} lessons
                          {item.status === 'in-progress' && ` · ${item.progress}% complete`}
                          {item.status === 'completed' && ' · Completed'}
                        </p>
                        {item.campaign.description && (
                          <p className="text-white/30 text-sm line-clamp-2">
                            {item.campaign.description}
                          </p>
                        )}
                        {/* Tags/Skills */}
                        {item.campaign.metadata?.tags && item.campaign.metadata.tags.length > 0 && (
                          <div className="flex items-center gap-2 mt-3">
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
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                  <Search size={48} className="text-white/20 mb-4" />
                  <p className="text-white/50 text-lg">No campaigns found</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Filter Section - Single Row (Sticky) */}
              <div className="sticky top-0 z-10 flex items-center gap-3 py-3 -mx-6 px-6 bg-[#050608]/80 backdrop-blur-md">
                {/* Filters Button */}
                <button
                  onClick={() => setIsFilterPanelOpen(true)}
                  className={`relative p-2 transition-all flex-shrink-0 ${activeFilterCount > 0
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

                {/* Skills Filter Chips - scrollable with fade edges */}
                <div className="flex-1 min-w-0 relative">
                  {/* Left fade gradient */}
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#050608]/80 to-transparent pointer-events-none z-10" />

                  {/* Right fade gradient */}
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#050608]/80 to-transparent pointer-events-none z-10" />

                  {/* Scrollable chips container */}
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-2">
                    <button
                      onClick={() => setDesktopFilters(f => ({ ...f, skill: null }))}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex-shrink-0 backdrop-blur-sm ${desktopFilters.skill === null
                        ? 'bg-white/90 text-black'
                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                    >
                      All
                    </button>
                    {ALL_SKILLS.map((skill, index) => {
                      // Find how many campaigns have this skill's parent competency
                      const skillCompetency = skill.competencyName;
                      const campaignCount = campaignsWithProgress.filter(item =>
                        item.campaign.metadata?.tags?.includes(skillCompetency) ||
                        item.campaign.skillFocus === skillCompetency
                      ).length;

                      return (
                        <button
                          key={skill.id}
                          onClick={() => setDesktopFilters(f => ({
                            ...f,
                            skill: f.skill === skill.name ? null : skill.name
                          }))}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex-shrink-0 whitespace-nowrap backdrop-blur-sm ${desktopFilters.skill === skill.name
                            ? 'bg-white/90 text-black'
                            : 'bg-white/5 text-white/70 hover:bg-white/10'
                            }`}
                          title={`${skill.competencyName} • ${skill.description}`}
                        >
                          {skill.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Filtered Results or Category Sections */}
              {(activeFilterCount > 0) ? (
                // Filtered Results View
                (() => {
                  // Find the parent competency for the selected skill
                  const selectedSkillData = desktopFilters.skill
                    ? ALL_SKILLS.find(s => s.name === desktopFilters.skill)
                    : null;
                  const filterCompetency = selectedSkillData?.competencyName || null;

                  const filteredResults = campaignsWithProgress.filter(item => {
                    // Skill filter (via parent competency)
                    const matchesSkill = !filterCompetency ||
                      item.campaign.metadata?.tags?.includes(filterCompetency) ||
                      item.campaign.skillFocus === filterCompetency;

                    // Status filter
                    const matchesStatus = desktopFilters.status === 'all' || item.status === desktopFilters.status;

                    // Source filter
                    const matchesSource = desktopFilters.source === 'all' ||
                      (desktopFilters.source === 'organization' && item.campaign.source === 'organization') ||
                      (desktopFilters.source === 'dicode' && item.campaign.source !== 'organization');

                    // Due date filter
                    let matchesDueDate = true;
                    if (desktopFilters.dueDate !== 'all') {
                      const endDate = item.campaign.schedule?.endDate ? new Date(item.campaign.schedule.endDate) : null;
                      const now = new Date();
                      if (desktopFilters.dueDate === 'no-deadline') {
                        matchesDueDate = !endDate;
                      } else if (!endDate) {
                        matchesDueDate = false;
                      } else {
                        const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        if (desktopFilters.dueDate === 'overdue') matchesDueDate = diffDays < 0;
                        else if (desktopFilters.dueDate === 'this-week') matchesDueDate = diffDays >= 0 && diffDays <= 7;
                        else if (desktopFilters.dueDate === 'this-month') matchesDueDate = diffDays >= 0 && diffDays <= 30;
                      }
                    }

                    // Created date filter
                    let matchesCreatedDate = true;
                    if (desktopFilters.createdDate !== 'all') {
                      const createdAt = item.campaign.metadata?.createdAt ? new Date(item.campaign.metadata.createdAt) : null;
                      if (!createdAt || isNaN(createdAt.getTime())) {
                        matchesCreatedDate = false;
                      } else {
                        const now = new Date();
                        const diffDays = Math.ceil((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
                        if (desktopFilters.createdDate === 'last-7-days') matchesCreatedDate = diffDays <= 7;
                        else if (desktopFilters.createdDate === 'last-30-days') matchesCreatedDate = diffDays <= 30;
                        else if (desktopFilters.createdDate === 'last-90-days') matchesCreatedDate = diffDays <= 90;
                      }
                    }

                    // Module count filter
                    let matchesModuleCount = true;
                    if (desktopFilters.moduleCount !== 'all') {
                      const moduleCount = item.campaign.items?.length || 0;
                      if (desktopFilters.moduleCount === '1-2') matchesModuleCount = moduleCount >= 1 && moduleCount <= 2;
                      else if (desktopFilters.moduleCount === '3-4') matchesModuleCount = moduleCount >= 3 && moduleCount <= 4;
                      else if (desktopFilters.moduleCount === '5+') matchesModuleCount = moduleCount >= 5;
                    }

                    return matchesSkill && matchesStatus && matchesSource && matchesDueDate && matchesCreatedDate && matchesModuleCount;
                  });

                  return (
                    <div>
                      <h2 className="text-white text-lg font-semibold mb-4">
                        {filteredResults.length} {filteredResults.length === 1 ? 'campaign' : 'campaigns'}
                        {desktopFilters.skill && ` for "${desktopFilters.skill}"`}
                        {activeFilterCount > 0 && <span className="text-white/50 font-normal text-sm ml-2">({activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} active)</span>}
                      </h2>
                      <div className="grid grid-cols-4 gap-x-4 gap-y-6">
                        {filteredResults.map((item, index) => (
                          <motion.button
                            key={item.campaign.id}
                            onClick={() => handleCampaignClick(item.campaign.id)}
                            className="text-left group"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <div className={`relative w-full aspect-video rounded-lg ${thumbnailColors[index % thumbnailColors.length]} mb-2 overflow-hidden flex items-center justify-center group-hover:ring-2 group-hover:ring-white/20 transition-all`}>
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
                            </div>
                            <h3 className="text-white text-sm font-medium line-clamp-2 leading-tight mb-1 group-hover:text-white/90">{item.campaign.title}</h3>
                            <p className="text-white/40 text-xs">{item.totalLessons} lessons · {item.durationMinutes || 0} min</p>
                          </motion.button>
                        ))}
                      </div>
                      {filteredResults.length === 0 && (
                        <div className="text-center py-12">
                          <BookOpen size={48} className="text-white/20 mx-auto mb-4" />
                          <p className="text-white/50 text-lg">No campaigns match your filters</p>
                          <button
                            onClick={resetFilters}
                            className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
                          >
                            Clear filters
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                // Default Category View
                <>
                  {/* Ongoing */}
                  {ongoingCampaigns.length > 0 && (
                    <div>
                      <h2 className="text-white text-sm font-semibold mb-3">Continue Learning</h2>
                      <div className="grid grid-cols-4 gap-x-4 gap-y-6">
                        {ongoingCampaigns.map((item, index) => (
                          <motion.button
                            key={item.campaign.id}
                            onClick={() => handleCampaignClick(item.campaign.id)}
                            className="text-left group"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <div className={`relative w-full aspect-video rounded-lg ${thumbnailColors[index % thumbnailColors.length]} mb-2 overflow-hidden flex items-center justify-center group-hover:ring-2 group-hover:ring-white/20 transition-all`}>
                              {item.thumbnailUrl ? (
                                <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <BookOpen size={24} className="text-white/60" />
                              )}
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                                <div className="h-full bg-blue-500" style={{ width: `${item.progress}%` }} />
                              </div>
                            </div>
                            <h3 className="text-white text-sm font-medium line-clamp-2 leading-tight mb-1 group-hover:text-white/90">{item.campaign.title}</h3>
                            <p className="text-white/40 text-xs">{item.progress}% complete</p>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Organization Campaigns */}
                  {organizationCampaigns.length > 0 && (
                    <div>
                      <h2 className="text-white text-sm font-semibold mb-3">{organizationName || 'Your Organization'}</h2>
                      <div className="grid grid-cols-4 gap-x-4 gap-y-6">
                        {organizationCampaigns.map((item, index) => (
                          <motion.button
                            key={item.campaign.id}
                            onClick={() => handleCampaignClick(item.campaign.id)}
                            className="text-left group"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <div className={`relative w-full aspect-video rounded-lg ${thumbnailColors[index % thumbnailColors.length]} mb-2 overflow-hidden flex items-center justify-center group-hover:ring-2 group-hover:ring-white/20 transition-all`}>
                              {item.thumbnailUrl ? (
                                <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <BookOpen size={24} className="text-white/60" />
                              )}
                            </div>
                            <h3 className="text-white text-sm font-medium line-clamp-2 leading-tight mb-1 group-hover:text-white/90">{item.campaign.title}</h3>
                            <p className="text-white/40 text-xs">{item.totalLessons} lessons · {item.durationMinutes || 0} min</p>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dicode Collections */}
                  {dicodeCampaigns.length > 0 && (
                    <div>
                      <h2 className="text-white text-sm font-semibold mb-3">Dicode Collections</h2>
                      <div className="grid grid-cols-4 gap-x-4 gap-y-6">
                        {dicodeCampaigns.map((item, index) => (
                          <motion.button
                            key={item.campaign.id}
                            onClick={() => handleCampaignClick(item.campaign.id)}
                            className="text-left group"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <div className={`relative w-full aspect-video rounded-lg ${thumbnailColors[index % thumbnailColors.length]} mb-2 overflow-hidden flex items-center justify-center group-hover:ring-2 group-hover:ring-white/20 transition-all`}>
                              {item.thumbnailUrl ? (
                                <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <BookOpen size={24} className="text-white/60" />
                              )}
                            </div>
                            <h3 className="text-white text-sm font-medium line-clamp-2 leading-tight mb-1 group-hover:text-white/90">{item.campaign.title}</h3>
                            <p className="text-white/40 text-xs">{item.totalLessons} lessons · {item.durationMinutes || 0} min</p>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completed */}
                  {completedCampaigns.length > 0 && (
                    <div>
                      <h2 className="text-white text-sm font-semibold mb-3">Completed</h2>
                      <div className="grid grid-cols-4 gap-x-4 gap-y-6">
                        {completedCampaigns.map((item, index) => (
                          <motion.button
                            key={item.campaign.id}
                            onClick={() => handleCampaignClick(item.campaign.id)}
                            className="text-left group"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <div className={`relative w-full aspect-video rounded-lg ${thumbnailColors[index % thumbnailColors.length]} mb-2 overflow-hidden flex items-center justify-center group-hover:ring-2 group-hover:ring-white/20 transition-all`}>
                              {item.thumbnailUrl ? (
                                <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <BookOpen size={24} className="text-white/60" />
                              )}
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                                  <Check size={16} className="text-white" strokeWidth={3} />
                                </div>
                              </div>
                            </div>
                            <h3 className="text-white text-sm font-medium line-clamp-2 leading-tight mb-1 group-hover:text-white/90">{item.campaign.title}</h3>
                            <p className="text-white/40 text-xs">{item.totalLessons} lessons · Completed</p>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Loading State */}
              {(isLoading || isLoadingEnrollments) && (
                <div className="grid grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-[#1a1a1a] rounded-2xl p-4">
                      <div className="w-full aspect-video rounded-xl bg-white/10 animate-pulse mb-3" />
                      <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse mb-2" />
                      <div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
                    <h2 className="text-white font-semibold text-lg">Filters</h2>
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
                      Clear All Filters
                    </button>
                  )}
                </div>

                {/* Filter Sections */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* Status Section */}
                  <div>
                    <h3 className="text-white/50 text-xs uppercase tracking-wider font-medium mb-3">Status</h3>
                    <div className="space-y-2">
                      {[
                        { id: 'all', label: 'All Statuses' },
                        { id: 'in-progress', label: 'In Progress' },
                        { id: 'not-started', label: 'Not Started' },
                        { id: 'completed', label: 'Completed' },
                      ].map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setDesktopFilters(f => ({ ...f, status: option.id as typeof f.status }))}
                          className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${desktopFilters.status === option.id
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-white/5 text-white/70 hover:bg-white/10 border border-transparent'
                            }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Source Section */}
                  <div>
                    <h3 className="text-white/50 text-xs uppercase tracking-wider font-medium mb-3">Source</h3>
                    <div className="space-y-2">
                      {[
                        { id: 'all', label: 'All Sources' },
                        { id: 'organization', label: 'Organization' },
                        { id: 'dicode', label: 'DiCode Collections' },
                      ].map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setDesktopFilters(f => ({ ...f, source: option.id as typeof f.source }))}
                          className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${desktopFilters.source === option.id
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-white/5 text-white/70 hover:bg-white/10 border border-transparent'
                            }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Due Date Section */}
                  <div>
                    <h3 className="text-white/50 text-xs uppercase tracking-wider font-medium mb-3">Due Date</h3>
                    <div className="space-y-2">
                      {[
                        { id: 'all', label: 'Any Due Date' },
                        { id: 'overdue', label: 'Overdue' },
                        { id: 'this-week', label: 'Due This Week' },
                        { id: 'this-month', label: 'Due This Month' },
                        { id: 'no-deadline', label: 'No Deadline' },
                      ].map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setDesktopFilters(f => ({ ...f, dueDate: option.id as typeof f.dueDate }))}
                          className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${desktopFilters.dueDate === option.id
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                            : 'bg-white/5 text-white/70 hover:bg-white/10 border border-transparent'
                            }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Created Date Section */}
                  <div>
                    <h3 className="text-white/50 text-xs uppercase tracking-wider font-medium mb-3">Created Date</h3>
                    <div className="space-y-2">
                      {[
                        { id: 'all', label: 'Any Time' },
                        { id: 'last-7-days', label: 'Last 7 Days' },
                        { id: 'last-30-days', label: 'Last 30 Days' },
                        { id: 'last-90-days', label: 'Last 90 Days' },
                      ].map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setDesktopFilters(f => ({ ...f, createdDate: option.id as typeof f.createdDate }))}
                          className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${desktopFilters.createdDate === option.id
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-white/5 text-white/70 hover:bg-white/10 border border-transparent'
                            }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Module Count Section */}
                  <div>
                    <h3 className="text-white/50 text-xs uppercase tracking-wider font-medium mb-3">Number of Modules</h3>
                    <div className="space-y-2">
                      {[
                        { id: 'all', label: 'Any Count' },
                        { id: '1-2', label: '1-2 Modules' },
                        { id: '3-4', label: '3-4 Modules' },
                        { id: '5+', label: '5+ Modules' },
                      ].map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setDesktopFilters(f => ({ ...f, moduleCount: option.id as typeof f.moduleCount }))}
                          className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${desktopFilters.moduleCount === option.id
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-white/5 text-white/70 hover:bg-white/10 border border-transparent'
                            }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10">
                  <button
                    onClick={() => setIsFilterPanelOpen(false)}
                    className="w-full py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
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
      <div className="min-h-screen lg:hidden pb-24">
        {/* Header */}
        <header className="sticky top-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f14]/95 to-transparent backdrop-blur-md" />
          <div className="relative flex items-center justify-between px-4 py-3">
            {/* Left: Avatar */}
            <button onClick={() => navigate('/employee/profile')}>
              <Avatar src={user?.avatar} name={user?.name} size="md" />
            </button>

            {/* Center: Streak */}
            <StreakInline count={streakStats.currentStreak} />

            {/* Right: Notification */}
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Bell size={20} className="text-white/70" strokeWidth={1.8} />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-semibold text-white">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Content Sheet - White sheet with rounded top corners */}
        <div className="bg-black rounded-t-[40px] mt-4 min-h-screen flex-1">
          <main className="px-4 pt-4 pb-24">
            {/* Search Bar */}
            <motion.div
              className="bg-[#1a1a1a] rounded-3xl p-4 space-y-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Search Input Row */}
              <div className="flex items-center gap-3">
                <Search size={20} className="text-white/50 flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchSubmit();
                      searchInputRef.current?.blur();
                    }
                  }}
                  placeholder="Search campaigns"
                  className="flex-1 bg-transparent text-white placeholder:text-white/50 text-base outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X size={18} className="text-white/50" />
                  </button>
                )}
                <button
                  onClick={() => setIsFilterOpen(true)}
                  className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <SlidersHorizontal size={20} className={mobileActiveFilterCount > 0 ? 'text-[#00A3FF]' : 'text-white/70'} />
                  {mobileActiveFilterCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#00A3FF] text-white text-[10px] font-bold px-1">
                      {mobileActiveFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/10" />

              {/* Recent Searches */}
              <div className="flex items-center gap-3">
                <span className="text-white/50 text-sm flex-shrink-0">Recent</span>
                {recentSearches.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
                    {recentSearches.map((term, index) => {
                      const isExpanded = expandedChip === term;
                      return (
                        <button
                          key={term}
                          onClick={() => {
                            if (isExpanded) {
                              // Second tap - collapse and search
                              setExpandedChip(null);
                              setSearchQuery(term);
                            } else {
                              // First tap - expand to show X
                              setExpandedChip(term);
                            }
                          }}
                          onMouseEnter={() => setExpandedChip(term)}
                          onMouseLeave={() => setExpandedChip(null)}
                          className={`px-4 py-1.5 rounded-full text-sm font-medium flex-shrink-0 flex items-center transition-all duration-200 ${tagColors[index % tagColors.length]}`}
                        >
                          <span>{term}</span>
                          <div
                            className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'w-5 ml-1.5' : 'w-0'}`}
                          >
                            <X
                              size={14}
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRecentSearch(term);
                                setExpandedChip(null);
                              }}
                            />
                          </div>
                        </button>
                      );
                    })}
                    {recentSearches.length > 1 && (
                      <button
                        onClick={clearRecentSearches}
                        className="px-3 py-1.5 rounded-full text-sm text-white/40 hover:text-white/60 flex-shrink-0 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-white/30 text-sm">No recent searches</span>
                )}
              </div>
            </motion.div>

            {/* Search Results - shown when there's an active search */}
            <AnimatePresence mode="wait">
              {searchQuery.trim() && (
                <motion.div
                  className="mt-6"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-white text-lg font-semibold">
                      {filteredCampaigns.length} {filteredCampaigns.length === 1 ? 'result' : 'results'} for "{searchQuery}"
                    </h2>
                  </div>

                  {filteredCampaigns.length > 0 ? (
                    <div className="space-y-3">
                      {filteredCampaigns.map((item, index) => {
                        const deadline = formatEndDate(item.endDate);
                        const isOverdue = deadline === 'Overdue';

                        return (
                          <motion.button
                            key={item.campaign.id}
                            onClick={() => handleCampaignClick(item.campaign.id)}
                            className="w-full bg-[#1a1a1a] rounded-2xl p-4 flex items-center gap-4 text-left"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
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
                                    <div
                                      className="h-full bg-white rounded-full transition-all"
                                      style={{ width: `${item.progress}%` }}
                                    />
                                  </div>
                                  {deadline && (
                                    <p className={`text-xs mt-1.5 ${isOverdue ? 'text-red-400' : 'text-amber-400'}`}>
                                      {deadline}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            <ArrowUpRight size={18} className="text-white/30 flex-shrink-0" />
                          </motion.button>
                        );
                      })}
                    </div>
                  ) : (
                    <motion.div
                      className="text-center py-12"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Search size={48} className="text-white/20 mx-auto mb-4" />
                      <p className="text-white/50 text-lg">No campaigns found</p>
                      <p className="text-white/30 text-sm mt-1">Try a different search term</p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Competencies Section - hidden when searching */}
            {!searchQuery.trim() && (
              <motion.div
                className="mt-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                {/* Section Header */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white text-lg font-semibold">Competencies</h2>
                  <button
                    onClick={() => navigate('/employee/learn/competencies')}
                    className="text-blue-400 text-sm font-medium flex items-center gap-1"
                  >
                    See all
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Horizontal Scroll Cards */}
                <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
                  <div className="flex gap-3">
                    {isLoading ? (
                      // Loading skeletons
                      Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-36 h-36 rounded-2xl bg-white/10 animate-pulse flex-shrink-0"
                        />
                      ))
                    ) : competencies.length > 0 ? (
                      competencies.map((competency, index) => (
                        <motion.button
                          key={competency.name}
                          onClick={() => handleCompetencyClick(competency.name)}
                          className={`w-36 h-36 rounded-2xl bg-gradient-to-br ${cardGradients[index % cardGradients.length]} p-3 flex flex-col justify-between flex-shrink-0 text-left relative overflow-hidden`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {/* Background Emoji */}
                          <span className="absolute -bottom-2 -right-2 text-6xl opacity-20 select-none pointer-events-none">
                            {getCompetencyEmoji(competency.name)}
                          </span>

                          {/* Favorite button */}
                          <div className="flex justify-end relative z-10">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                              <Heart size={16} className="text-white" />
                            </div>
                          </div>

                          {/* Content */}
                          <div className="relative z-10">
                            <h3 className="text-white font-semibold text-base leading-tight mb-1">
                              {competency.name}
                            </h3>
                            <p className="text-white/80 text-sm">
                              {competency.count} {competency.count === 1 ? 'campaign' : 'campaigns'}
                            </p>
                          </div>
                        </motion.button>
                      ))
                    ) : (
                      <div className="text-white/50 text-sm py-4">
                        No competencies available
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Campaign Lists - hidden when searching */}
            {!searchQuery.trim() && (
              <motion.div
                className="mt-8 space-y-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                {/* Ongoing Section */}
                {ongoingCampaigns.length > 0 && (
                  <div>
                    <h2 className="text-white text-lg font-semibold mb-4">Ongoing</h2>
                    <div className="space-y-3">
                      {ongoingCampaigns.map((item, index) => {
                        const deadline = formatEndDate(item.endDate);
                        const isOverdue = deadline === 'Overdue';

                        return (
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
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h3 className="text-white font-semibold text-[15px] truncate">
                                    {item.campaign.title}
                                  </h3>
                                  <p className="text-white/50 text-sm truncate">
                                    {item.nextVideoTitle
                                      ? `Up next: ${item.nextVideoTitle}`
                                      : item.campaign.source === 'organization'
                                        ? organizationName || 'Your Organization'
                                        : 'Dicode'
                                    }
                                  </p>
                                </div>
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-white/30 p-1 flex-shrink-0 cursor-pointer"
                                >
                                  <MoreVertical size={16} />
                                </div>
                              </div>

                              {/* Progress info */}
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span>{item.totalLessons} lessons</span>
                                    {item.durationMinutes > 0 && (
                                      <>
                                        <span>·</span>
                                        <span className="flex items-center gap-1">
                                          <Clock size={10} />
                                          {item.durationMinutes} min
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <span>{item.progress}%</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-white rounded-full transition-all"
                                    style={{ width: `${item.progress}%` }}
                                  />
                                </div>
                                {deadline && (
                                  <p className={`text-xs mt-1.5 ${isOverdue ? 'text-red-400' : 'text-amber-400'}`}>
                                    {deadline}
                                  </p>
                                )}
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Your Organization Section */}
                {organizationCampaigns.length > 0 && (
                  <div>
                    <h2 className="text-white text-lg font-semibold mb-4">{organizationName || 'Your Organization'}</h2>
                    <div className="space-y-3">
                      {organizationCampaigns.map((item, index) => (
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
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="text-white font-semibold text-[15px] truncate">
                                  {item.campaign.title}
                                </h3>
                                <p className="text-white/50 text-sm truncate flex items-center gap-2">
                                  <span>{item.totalLessons} lessons</span>
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
                              </div>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="text-white/30 p-1 flex-shrink-0"
                              >
                                <MoreVertical size={16} />
                              </button>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dicode Collections Section */}
                {dicodeCampaigns.length > 0 && (
                  <div>
                    <h2 className="text-white text-lg font-semibold mb-4">Dicode Collections</h2>
                    <div className="space-y-3">
                      {dicodeCampaigns.map((item, index) => (
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
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="text-white font-semibold text-[15px] truncate">
                                  {item.campaign.title}
                                </h3>
                                <p className="text-white/50 text-sm truncate flex items-center gap-2">
                                  <span>{item.totalLessons} lessons</span>
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
                              </div>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="text-white/30 p-1 flex-shrink-0"
                              >
                                <MoreVertical size={16} />
                              </button>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Section */}
                {completedCampaigns.length > 0 && (
                  <div>
                    <h2 className="text-white text-lg font-semibold mb-4">Completed</h2>
                    <div className="space-y-3">
                      {completedCampaigns.map((item, index) => (
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
                              {/* Green gradient check badge with glow */}
                              <div
                                className="w-5 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0"
                                style={{ boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)' }}
                              >
                                <Check size={12} className="text-white" strokeWidth={3} />
                              </div>
                            </div>
                            <p className="text-white/50 text-sm mt-0.5 flex items-center gap-2">
                              <span>
                                {item.campaign.source === 'organization'
                                  ? organizationName || 'Your Organization'
                                  : 'Dicode'
                                } · {item.totalLessons} lessons
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
                          </div>

                          <ChevronRight size={20} className="text-white/30 flex-shrink-0" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {(isLoading || isLoadingEnrollments) && (
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
                )}

                {/* Empty State - only when not searching */}
                {!isLoading && !isLoadingEnrollments && campaignsWithProgress.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-white/50">No campaigns available</p>
                  </div>
                )}
              </motion.div>
            )}
          </main>
        </div>

        {/* Filter Sheet */}
        <FilterSheet
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          filters={filters}
          onApply={setFilters}
        />

        {/* Notifications Sheet */}
        <NotificationsSheet
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          notifications={notifications}
          onMarkAllRead={markAllAsRead}
          onNotificationClick={(notification) => {
            // Mark as read when clicked
            markAsRead(notification.id);
            // Close sheet and navigate based on type
            setIsNotificationsOpen(false);
            if (notification.type === 'campaign') {
              // Could navigate to a specific campaign if needed
            }
          }}
        />
        {/* AI Copilot */}
        {isCopilotOpen && (
          <AICopilot
            isOpen={isCopilotOpen}
            onClose={() => setIsCopilotOpen(false)}
            context={{
              userRole: 'employee',
              learningContext: {
                currentCampaign: undefined,
                currentModule: undefined,
                streakStatus: {
                  current: streakStats.currentStreak,
                  atRisk: false,
                },
              }
            }}
          />
        )}
      </div>
    </>
  );
};

export default Learn;
