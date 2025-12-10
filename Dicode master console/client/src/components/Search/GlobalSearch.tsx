'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  LayoutGrid,
  Film,
  FolderOpen,
  Building2,
  Clock,
  ArrowRight,
  Command,
  Loader2,
} from 'lucide-react';
import { getAllCampaigns, getAllVideos, getAssetsByUser } from '@/lib/firestore';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Campaign, Video, Asset, Organization } from '@/lib/types';

interface SearchResult {
  id: string;
  type: 'campaign' | 'video' | 'asset' | 'client' | 'page';
  title: string;
  subtitle?: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const quickPages: SearchResult[] = [
  { id: 'home', type: 'page', title: 'Home', path: '/', icon: LayoutGrid },
  { id: 'campaigns', type: 'page', title: 'Campaigns', path: '/campaigns', icon: LayoutGrid },
  { id: 'new-campaign', type: 'page', title: 'New Campaign', path: '/campaigns/new', icon: LayoutGrid },
  { id: 'generate', type: 'page', title: 'Video Generator', path: '/generate', icon: Film },
  { id: 'videos', type: 'page', title: 'Video Library', path: '/videos', icon: Film },
  { id: 'assets', type: 'page', title: 'Prompt Assets', path: '/assets', icon: FolderOpen },
  { id: 'clients', type: 'page', title: 'Clients', path: '/clients', icon: Building2 },
  { id: 'analytics', type: 'page', title: 'Analytics', path: '/analytics', icon: LayoutGrid },
];

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load data on mount
  useEffect(() => {
    if (isOpen) {
      loadData();
      inputRef.current?.focus();
      
      // Load recent searches from localStorage
      const saved = localStorage.getItem('dicode_recent_searches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    }
  }, [isOpen]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [campaignsData, videosData, assetsData] = await Promise.all([
        getAllCampaigns(),
        getAllVideos(),
        getAssetsByUser(),
      ]);

      setCampaigns(campaignsData);
      setVideos(videosData);
      setAssets(assetsData);

      // Load organizations
      const orgsSnapshot = await getDocs(
        query(collection(db, 'organizations'), orderBy('name'), limit(50))
      );
      const orgsData = orgsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Organization[];
      setOrganizations(orgsData);
    } catch (error) {
      console.error('Failed to load search data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter results based on search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    // Search pages
    quickPages.forEach(page => {
      if (page.title.toLowerCase().includes(query)) {
        results.push(page);
      }
    });

    // Search campaigns
    campaigns.forEach(campaign => {
      if (
        campaign.title.toLowerCase().includes(query) ||
        campaign.description?.toLowerCase().includes(query)
      ) {
        results.push({
          id: `campaign-${campaign.id}`,
          type: 'campaign',
          title: campaign.title,
          subtitle: campaign.metadata.isPublished ? 'Published' : 'Draft',
          path: `/campaign?id=${campaign.id}`,
          icon: LayoutGrid,
        });
      }
    });

    // Search videos
    videos.forEach(video => {
      if (
        video.title.toLowerCase().includes(query) ||
        video.description?.toLowerCase().includes(query)
      ) {
        results.push({
          id: `video-${video.id}`,
          type: 'video',
          title: video.title,
          subtitle: video.source === 'generated' ? 'AI Generated' : 'Uploaded',
          path: `/videos`,
          icon: Film,
        });
      }
    });

    // Search assets
    assets.forEach(asset => {
      if (
        asset.name.toLowerCase().includes(query) ||
        asset.description?.toLowerCase().includes(query)
      ) {
        results.push({
          id: `asset-${asset.id}`,
          type: 'asset',
          title: asset.name,
          subtitle: asset.type,
          path: `/assets`,
          icon: FolderOpen,
        });
      }
    });

    // Search organizations
    organizations.forEach(org => {
      if (
        org.name.toLowerCase().includes(query) ||
        org.industry?.toLowerCase().includes(query)
      ) {
        results.push({
          id: `org-${org.id}`,
          type: 'client',
          title: org.name,
          subtitle: org.industry,
          path: `/clients`,
          icon: Building2,
        });
      }
    });

    return results.slice(0, 10);
  }, [searchQuery, campaigns, videos, assets, organizations]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    const results = searchQuery.trim() ? searchResults : quickPages;
    const maxIndex = results.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, maxIndex));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, searchQuery, searchResults, selectedIndex, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSelect = (result: SearchResult) => {
    // Save to recent searches
    if (searchQuery.trim()) {
      const newRecent = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
      setRecentSearches(newRecent);
      localStorage.setItem('dicode_recent_searches', JSON.stringify(newRecent));
    }

    router.push(result.path);
    onClose();
  };

  const displayResults = searchQuery.trim() ? searchResults : quickPages;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2 animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 border-b border-slate-200 px-4">
            <Search className="h-5 w-5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Search campaigns, videos, assets, clients..."
              className="h-14 flex-1 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            {loading && <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />}
            <kbd className="hidden sm:flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">
              <span>esc</span>
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto p-2">
            {!searchQuery.trim() && recentSearches.length > 0 && (
              <div className="mb-2">
                <p className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Recent Searches
                </p>
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => setSearchQuery(search)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <Clock className="h-4 w-4 text-slate-400" />
                    {search}
                  </button>
                ))}
              </div>
            )}

            {!searchQuery.trim() && (
              <p className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Quick Navigation
              </p>
            )}

            {searchQuery.trim() && displayResults.length === 0 && (
              <div className="py-8 text-center">
                <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No results found for "{searchQuery}"</p>
              </div>
            )}

            {displayResults.map((result, index) => {
              const Icon = result.icon;
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                    isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    result.type === 'campaign' ? 'bg-sky-100 text-sky-600' :
                    result.type === 'video' ? 'bg-violet-100 text-violet-600' :
                    result.type === 'asset' ? 'bg-amber-100 text-amber-600' :
                    result.type === 'client' ? 'bg-emerald-100 text-emerald-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {result.title}
                    </p>
                    {result.subtitle && (
                      <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
                    )}
                  </div>
                  {isSelected && (
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-slate-200 px-1.5 py-0.5">↑</kbd>
                <kbd className="rounded bg-slate-200 px-1.5 py-0.5">↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-slate-200 px-1.5 py-0.5">↵</kbd>
                to select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-slate-200 px-1.5 py-0.5">esc</kbd>
              to close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

