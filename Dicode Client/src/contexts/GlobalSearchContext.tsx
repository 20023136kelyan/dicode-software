import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getPublishedCampaigns, getVideo, getOrganization } from '@/lib/firestore';
import { useUserEnrollmentsRealtime } from '@/hooks/useEnrollmentRealtime';
import type { Campaign, CampaignEnrollment } from '@/types';

// localStorage key for recent searches
const RECENT_SEARCHES_KEY = 'dicode_recent_searches';
const MAX_RECENT_SEARCHES = 5;

// Campaign with progress info
export interface CampaignWithProgress {
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

interface GlobalSearchContextType {
  // Search state
  isSearchOpen: boolean;
  searchQuery: string;
  recentSearches: string[];

  // Data
  campaigns: Campaign[];
  campaignsWithProgress: CampaignWithProgress[];
  filteredCampaigns: CampaignWithProgress[];
  organizationName: string;
  isLoading: boolean;

  // Actions
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
  saveRecentSearch: (term: string) => void;
  removeRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextType | null>(null);

export const useGlobalSearch = () => {
  const context = useContext(GlobalSearchContext);
  if (!context) {
    throw new Error('useGlobalSearch must be used within a GlobalSearchProvider');
  }
  return context;
};

export const GlobalSearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [organizationName, setOrganizationName] = useState('');
  const [videoMetadata, setVideoMetadata] = useState<Record<string, { title: string; duration: number }>>({});
  const [campaignDurations, setCampaignDurations] = useState<Record<string, number>>({});

  // Get enrollments
  const { enrollments, isLoading: isLoadingEnrollments } = useUserEnrollmentsRealtime(user?.id || '');

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

  // Fetch thumbnails and video metadata for campaigns
  useEffect(() => {
    const fetchVideoData = async () => {
      const newThumbnails: Record<string, string> = {};
      const newVideoMetadata: Record<string, { title: string; duration: number }> = {};
      const newCampaignDurations: Record<string, number> = {};

      for (const campaign of campaigns) {
        let totalDuration = 0;

        for (const item of campaign.items || []) {
          if (item.videoId) {
            try {
              const video = await getVideo(item.videoId);
              if (video) {
                newVideoMetadata[item.videoId] = {
                  title: video.title || `Lesson ${campaign.items.indexOf(item) + 1}`,
                  duration: video.duration || 0,
                };
                totalDuration += video.duration || 0;

                if (item === campaign.items[0] && video.thumbnailUrl) {
                  newThumbnails[campaign.id] = video.thumbnailUrl;
                }
              }
            } catch (error) {
              // Silent fail for video fetch
            }
          }
        }

        newCampaignDurations[campaign.id] = Math.ceil(totalDuration / 60);
      }

      setThumbnails(newThumbnails);
      setVideoMetadata(newVideoMetadata);
      setCampaignDurations(newCampaignDurations);
    };

    if (campaigns.length > 0) {
      fetchVideoData();
    }
  }, [campaigns]);

  // Combine campaigns with enrollment data
  const campaignsWithProgress: CampaignWithProgress[] = React.useMemo(() => {
    return campaigns.map(campaign => {
      const enrollment = enrollments.find(e => e.campaignId === campaign.id) || null;
      const totalLessons = campaign.items?.length || 0;

      let status: 'not-started' | 'in-progress' | 'completed' = 'not-started';
      let progress = 0;
      let nextVideoIndex = 0;

      if (enrollment) {
        const moduleProgressMap = enrollment.moduleProgress || {};

        const completedModules =
          enrollment.completedModules ??
          Object.values(moduleProgressMap).filter((m) => m.completed).length;

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

        const firstIncompleteIndex = (campaign.items || []).findIndex(
          item => !moduleProgressMap[item.id]?.completed
        );
        nextVideoIndex = firstIncompleteIndex === -1 ? totalLessons - 1 : firstIncompleteIndex;

        const hasAnyProgress = progress > 0 || Object.keys(moduleProgressMap).length > 0;

        if (enrollment.status === 'completed' || (totalLessons > 0 && completedModules >= totalLessons)) {
          status = 'completed';
          progress = 100;
        } else if (enrollment.status === 'in-progress' || hasAnyProgress) {
          status = 'in-progress';
        }
      }

      const nextVideoId = campaign.items?.[nextVideoIndex]?.videoId;
      const nextVideoTitle = nextVideoId ? videoMetadata[nextVideoId]?.title : undefined;

      return {
        campaign,
        enrollment,
        status,
        progress,
        totalLessons,
        thumbnailUrl: thumbnails[campaign.id],
        nextVideoTitle,
        nextVideoIndex,
        durationMinutes: campaignDurations[campaign.id] || 0,
        endDate: campaign.schedule?.endDate,
      };
    });
  }, [campaigns, enrollments, thumbnails, videoMetadata, campaignDurations]);

  // Filter campaigns by search query
  const filteredCampaigns = React.useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    return campaignsWithProgress.filter(item =>
      item.campaign.title.toLowerCase().includes(query) ||
      item.campaign.skillFocus?.toLowerCase().includes(query) ||
      item.campaign.metadata?.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  }, [campaignsWithProgress, searchQuery]);

  // Actions
  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
  }, []);

  const saveRecentSearch = useCallback((term: string) => {
    if (!term.trim()) return;

    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== term.toLowerCase());
      const updated = [term, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeRecentSearch = useCallback((term: string) => {
    setRecentSearches(prev => {
      const updated = prev.filter(s => s !== term);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  }, []);

  const value: GlobalSearchContextType = {
    isSearchOpen,
    searchQuery,
    recentSearches,
    campaigns,
    campaignsWithProgress,
    filteredCampaigns,
    organizationName,
    isLoading: isLoading || isLoadingEnrollments,
    openSearch,
    closeSearch,
    setSearchQuery,
    saveRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  };

  return (
    <GlobalSearchContext.Provider value={value}>
      {children}
    </GlobalSearchContext.Provider>
  );
};

export default GlobalSearchContext;
