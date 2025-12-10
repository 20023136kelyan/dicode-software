import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    X,
    LayoutGrid,
    Film,
    User,
    Building2,
    Clock,
    ArrowRight,
    Loader2,
    Users,
    Megaphone
} from 'lucide-react';
import { getCampaignsForAdmin, getAllVideos, getUsersByOrganization } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
import type { Campaign, Video, Employee } from '@/types';

interface SearchResult {
    id: string;
    type: 'campaign' | 'video' | 'employee' | 'page';
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
    { id: 'dashboard', type: 'page', title: 'Overview', path: '/admin', icon: LayoutGrid },
    { id: 'campaigns', type: 'page', title: 'Campaigns', path: '/admin/campaigns', icon: Megaphone },
    { id: 'employees', type: 'page', title: 'Employees', path: '/admin/employees', icon: Users },
    { id: 'asset-library', type: 'page', title: 'Asset Library', path: '/admin/assets', icon: Film }, // Using Film/Folder icon
    { id: 'company', type: 'page', title: 'Company Settings', path: '/admin/company', icon: Building2 },
];

const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const inputRef = useRef<HTMLInputElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [videos, setVideos] = useState<Video[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    // Load data on mount/open
    useEffect(() => {
        if (isOpen && user?.organization) {
            loadData();
            // Focus input
            setTimeout(() => {
                inputRef.current?.focus();
            }, 10);

            // Load recent searches from localStorage
            const saved = localStorage.getItem('dicode_admin_recent_searches');
            if (saved) {
                try {
                    setRecentSearches(JSON.parse(saved));
                } catch (e) {
                    console.error('Failed to parse recent searches', e);
                }
            }
        }
    }, [isOpen, user?.organization]);

    // Reset state when closed
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);

    const loadData = async () => {
        if (!user?.organization) return;

        setLoading(true);
        try {
            const [campaignsData, videosData, employeesData] = await Promise.all([
                getCampaignsForAdmin(user.organization),
                getAllVideos(user.organization),
                getUsersByOrganization(user.organization),
            ]);

            setCampaigns(campaignsData);
            setVideos(videosData);
            setEmployees(employeesData);
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
                    path: `/admin/campaigns/${campaign.id}`, // Assuming detail route exists or fallback to list
                    icon: Megaphone,
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
                    path: `/admin/assets?tab=videos&search=${encodeURIComponent(video.title)}`, // Navigate to assets with filter
                    icon: Film,
                });
            }
        });

        // Search employees
        employees.forEach(employee => {
            if (
                employee.name.toLowerCase().includes(query) ||
                employee.email.toLowerCase().includes(query) ||
                employee.department?.toLowerCase().includes(query)
            ) {
                results.push({
                    id: `employee-${employee.id}`,
                    type: 'employee',
                    title: employee.name,
                    subtitle: employee.role === 'admin' ? 'Admin' : employee.department || 'Employee',
                    path: `/admin/employees/${employee.id}`, // Assuming detail route exists or fallback
                    icon: User,
                });
            }
        });

        return results.slice(0, 10); // Limit to top 10
    }, [searchQuery, campaigns, videos, employees]);

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
            localStorage.setItem('dicode_admin_recent_searches', JSON.stringify(newRecent));
        }

        navigate(result.path);
        onClose();
    };

    const displayResults = searchQuery.trim() ? searchResults : quickPages;

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2 animate-in fade-in slide-in-from-top-4 duration-200 px-4">
                <div className="rounded-2xl border border-white/10 bg-[#1F1F1F] shadow-2xl overflow-hidden">
                    {/* Search Input */}
                    <div className="flex items-center gap-3 border-b border-white/10 px-4">
                        <Search className="h-5 w-5 text-white/40" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setSelectedIndex(0);
                            }}
                            placeholder="Search campaigns, employees, videos..."
                            className="h-14 flex-1 bg-transparent text-white placeholder:text-white/30 focus:outline-none text-lg"
                        />
                        {loading && <Loader2 className="h-5 w-5 text-white/40 animate-spin" />}
                        <div className="hidden sm:flex items-center gap-1">
                            <kbd className="px-2 py-1 text-xs text-white/40 bg-white/5 rounded border border-white/10 font-sans">
                                ESC
                            </kbd>
                        </div>
                    </div>

                    {/* Results */}
                    <div className="max-h-[60vh] overflow-y-auto p-2">
                        {!searchQuery.trim() && recentSearches.length > 0 && (
                            <div className="mb-2">
                                <p className="px-3 py-2 text-xs font-medium text-white/40 uppercase tracking-wider">
                                    Recent Searches
                                </p>
                                {recentSearches.map((search, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setSearchQuery(search)}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/70 hover:bg-white/5 transition-colors"
                                    >
                                        <Clock className="h-4 w-4 text-white/30" />
                                        {search}
                                    </button>
                                ))}
                            </div>
                        )}

                        {!searchQuery.trim() && (
                            <p className="px-3 py-2 text-xs font-medium text-white/40 uppercase tracking-wider">
                                Quick Navigation
                            </p>
                        )}

                        {searchQuery.trim() && displayResults.length === 0 && !loading && (
                            <div className="py-12 text-center">
                                <Search className="h-10 w-10 text-white/10 mx-auto mb-3" />
                                <p className="text-white/50">No results found for "{searchQuery}"</p>
                                <p className="text-white/30 text-sm mt-1">Try a different search term</p>
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
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                                        }`}
                                >
                                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${result.type === 'campaign' ? 'bg-blue-500/20 text-blue-400' :
                                            result.type === 'video' ? 'bg-purple-500/20 text-purple-400' :
                                                result.type === 'employee' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    'bg-white/10 text-white/60'
                                        }`}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-white/80'}`}>
                                            {result.title}
                                        </p>
                                        {result.subtitle && (
                                            <p className="text-xs text-white/40 truncate">{result.subtitle}</p>
                                        )}
                                    </div>
                                    {isSelected && (
                                        <ArrowRight className="h-4 w-4 text-white/40" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="hidden sm:flex items-center justify-between border-t border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white/40">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                                <kbd className="rounded bg-white/10 px-1.5 py-0.5 border border-white/5">↑</kbd>
                                <kbd className="rounded bg-white/10 px-1.5 py-0.5 border border-white/5">↓</kbd>
                                <span>to navigate</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <kbd className="rounded bg-white/10 px-1.5 py-0.5 border border-white/5">↵</kbd>
                                <span>to select</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default GlobalSearch;
