'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import { Campaign } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getCampaignsByUser } from '@/lib/firestore';
import {
  LayoutGrid,
  List,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  Users,
  CheckCircle,
  Clock,
} from 'lucide-react';

type ViewMode = 'grid' | 'list';
type StatusFilter = 'all' | 'published' | 'draft';

export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const statusFilter = (searchParams.get('status') as StatusFilter) || 'all';

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchCampaigns = async () => {
      try {
        const userCampaigns = await getCampaignsByUser(user.uid);
        setCampaigns(userCampaigns);
      } catch (error) {
        console.error('Failed to fetch campaigns:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [user]);

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      campaign.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.skillFocus.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
        (statusFilter === 'published' && campaign.metadata.isPublished) ||
        (statusFilter === 'draft' && !campaign.metadata.isPublished);

      return matchesSearch && matchesStatus;
  });

  const publishedCount = campaigns.filter((c) => c.metadata.isPublished).length;
  const draftCount = campaigns.length - publishedCount;

  const setStatusFilter = (filter: StatusFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('status', filter);
    router.push(`/campaigns?${params.toString()}`);
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Campaigns</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your behavioral coaching campaigns
                </p>
          </div>
                  <button
                    onClick={() => router.push('/campaigns/new')}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                  >
            <Plus className="h-4 w-4" />
            New Campaign
                  </button>
                </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{campaigns.length}</p>
                <p className="text-xs text-slate-500">Total Campaigns</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{publishedCount}</p>
                <p className="text-xs text-slate-500">Published</p>
              </div>
                </div>
                </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <Clock className="h-5 w-5" />
                </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{draftCount}</p>
                <p className="text-xs text-slate-500">Drafts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {/* Status Tabs */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
              {(['all', 'published', 'draft'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    statusFilter === filter
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search campaigns..."
                className="h-9 w-64 rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 transition focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                />
            </div>

            {/* View Toggle */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                  viewMode === 'grid'
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                  viewMode === 'list'
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            </div>
          </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin" />
            <p className="mt-4 text-sm text-slate-500">Loading campaigns...</p>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-4">
              <LayoutGrid className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              {campaigns.length === 0 ? 'No campaigns yet' : 'No matching campaigns'}
              </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm">
                {campaigns.length === 0
                ? 'Create your first campaign to start designing behavioral coaching programs.'
                : 'Try adjusting your search or filters.'}
              </p>
              {campaigns.length === 0 && user && (
                <button
                  onClick={() => router.push('/campaigns/new')}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                <Plus className="h-4 w-4" />
                Create Campaign
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  onClick={() => router.push(`/campaign?id=${campaign.id}`)}
                className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-md"
                >
                <div className="flex items-start justify-between mb-3">
                    <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      campaign.metadata.isPublished
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {campaign.metadata.isPublished ? 'Published' : 'Draft'}
                    </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Add dropdown menu logic
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  </div>

                <h3 className="text-base font-semibold text-slate-900 line-clamp-1 mb-1">
                  {campaign.title}
                </h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                  {campaign.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {campaign.items.length} modules
                    </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {campaign.metadata.updatedAt
                      ? new Date(campaign.metadata.updatedAt).toLocaleDateString()
                      : '—'}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {campaign.skillFocus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Campaign
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Skill Focus
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Modules
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Updated
                  </th>
                  <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCampaigns.map((campaign) => (
                    <tr
                      key={campaign.id}
                      onClick={() => router.push(`/campaign?id=${campaign.id}`)}
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
                    <td className="px-4 py-3">
                        <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            campaign.metadata.isPublished
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {campaign.metadata.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>
                    <td className="px-4 py-3">
                        <div>
                        <p className="text-sm font-medium text-slate-900">{campaign.title}</p>
                        <p className="text-xs text-slate-500 line-clamp-1">{campaign.description}</p>
                        </div>
                      </td>
                    <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          {campaign.skillFocus}
                        </span>
                      </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {campaign.items.length}
                      </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-500">
                      {campaign.metadata.updatedAt
                        ? new Date(campaign.metadata.updatedAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Add dropdown menu logic
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        {/* Auth Warning */}
          {!user && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
              <Users className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">Please sign in to create and manage campaigns.</p>
            </div>
          )}
      </div>
    </MainLayout>
  );
}
