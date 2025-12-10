'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import { Campaign } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import {
  getCampaignsByUserList,
  getAllCampaignsList,
  deleteCampaign,
  setCampaignPublishState,
  bulkDeleteCampaigns,
  bulkUpdateCampaignStatus
} from '@/lib/firestore';
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
  Trash2,
  Copy,
  Pencil,
  Archive,
  UploadCloud,
  X,
} from 'lucide-react';
import { Skeleton, CardSkeleton, StatCardSkeleton } from '@/components/ui/skeleton';

type ViewMode = 'grid' | 'list';
type StatusFilter = 'all' | 'published' | 'draft';

export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { error: showError, success: showSuccess } = useNotification();

  // Data State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // UI State
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Bulk Selection State
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());

  const statusFilter = (searchParams.get('status') as StatusFilter) || 'all';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const loadCampaigns = async () => {
    if (!user) return;
    try {
      const isDiCodeStaff = user.email?.endsWith('@di-code.de');
      // Use lightweight list functions to avoid N+1 fetches
      const fetchedCampaigns = isDiCodeStaff
        ? (await getAllCampaignsList()).filter(c => c.source === 'dicode' || !c.source)
        : await getCampaignsByUserList(user.uid);
      setCampaigns(fetchedCampaigns);
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
      showError('Error', 'Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [user]);

  // Bulk Handlers
  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedCampaignIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedCampaignIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedCampaignIds.size === filteredCampaigns.length) {
      setSelectedCampaignIds(new Set());
    } else {
      setSelectedCampaignIds(new Set(filteredCampaigns.map(c => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedCampaignIds.size} campaigns? This cannot be undone.`)) return;

    try {
      await bulkDeleteCampaigns(Array.from(selectedCampaignIds));
      showSuccess('Success', 'Campaigns deleted successfully');
      setSelectedCampaignIds(new Set());
      await loadCampaigns();
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      showError('Error', 'Failed to delete campaigns');
    }
  };

  const handleBulkPublish = async () => {
    try {
      await bulkUpdateCampaignStatus(Array.from(selectedCampaignIds), true);
      showSuccess('Success', 'Campaigns published successfully');
      setSelectedCampaignIds(new Set());
      await loadCampaigns();
    } catch (error) {
      console.error('Failed to bulk publish:', error);
      showError('Error', 'Failed to publish campaigns');
    }
  };

  const handleBulkUnpublish = async () => {
    try {
      await bulkUpdateCampaignStatus(Array.from(selectedCampaignIds), false);
      showSuccess('Success', 'Campaigns unpublished successfully');
      setSelectedCampaignIds(new Set());
      await loadCampaigns();
    } catch (error) {
      console.error('Failed to bulk unpublish:', error);
      showError('Error', 'Failed to unpublish campaigns');
    }
  };

  // Single Item Handlers
  const handleDelete = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this campaign? This cannot be undone.')) return;

    setDeleting(campaignId);
    setOpenMenuId(null);
    try {
      await deleteCampaign(campaignId);
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      showSuccess('Success', 'Campaign deleted');
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      showError('Error', 'Failed to delete campaign');
    } finally {
      setDeleting(null);
    }
  };

  const handleDuplicate = (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    router.push(`/campaigns/new?duplicate=${campaignId}`);
  };

  const handleEdit = (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    router.push(`/campaign/edit?id=${campaignId}`);
  };

  const handleUnpublish = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to unpublish this campaign? It will be moved to drafts.')) return;

    setOpenMenuId(null);
    try {
      await setCampaignPublishState(campaignId, false);
      // Optimistic update
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId
            ? { ...c, metadata: { ...c.metadata, isPublished: false, updatedAt: new Date() } }
            : c
        )
      );
      showSuccess('Success', 'Campaign unpublished');
    } catch (error) {
      console.error('Failed to unpublish campaign:', error);
      showError('Error', 'Failed to unpublish campaign');
    }
  };

  const handlePublish = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to publish this campaign? It will become visible to users.')) return;

    setOpenMenuId(null);
    try {
      await setCampaignPublishState(campaignId, true);
      // Optimistic update
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId
            ? { ...c, metadata: { ...c.metadata, isPublished: true, updatedAt: new Date() } }
            : c
        )
      );
      showSuccess('Success', 'Campaign published');
    } catch (error) {
      console.error('Failed to publish campaign:', error);
      showError('Error', 'Failed to publish campaign');
    }
  };

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

  // Determined available bulk actions based on selection
  const selectedCampaignsList = campaigns.filter(c => selectedCampaignIds.has(c.id));
  const hasPublishedSelected = selectedCampaignsList.some(c => c.metadata.isPublished);
  const hasDraftSelected = selectedCampaignsList.some(c => !c.metadata.isPublished);

  return (
    <MainLayout>
      <div className="space-y-6 relative">

        {/* Bulk Action Toolbar */}
        {selectedCampaignIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-3 shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-3 border-r border-slate-100 pr-4">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {selectedCampaignIds.size}
              </span>
              <span className="text-sm font-medium text-slate-700">Selected</span>
            </div>

            {hasDraftSelected && (
              <button
                onClick={handleBulkPublish}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition"
              >
                <UploadCloud className="h-4 w-4" />
                Publish
              </button>
            )}

            {hasPublishedSelected && (
              <button
                onClick={handleBulkUnpublish}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50 transition"
              >
                <Archive className="h-4 w-4" />
                Unpublish
              </button>
            )}

            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>

            <button
              onClick={() => setSelectedCampaignIds(new Set())}
              className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

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
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${statusFilter === filter
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
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
                className={`flex h-7 w-7 items-center justify-center rounded-md transition ${viewMode === 'grid'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-400 hover:text-slate-600'
                  }`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition ${viewMode === 'list'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-400 hover:text-slate-600'
                  }`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* New Campaign Button */}
            <button
              onClick={() => router.push('/campaigns/new')}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New Campaign
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
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
                onClick={() => {
                  if (selectedCampaignIds.size > 0) {
                    toggleSelection(campaign.id);
                  } else {
                    router.push(`/campaign?id=${campaign.id}`);
                  }
                }}
                className={`group relative cursor-pointer rounded-xl border bg-white p-5 transition hover:shadow-md ${selectedCampaignIds.has(campaign.id) ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'
                  }`}
              >
                {/* Selection Checkbox Overlay */}
                <div className="absolute top-3 left-3 z-10">
                  <input
                    type="checkbox"
                    checked={selectedCampaignIds.has(campaign.id)}
                    onChange={() => toggleSelection(campaign.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer shadow-sm"
                  />
                </div>

                <div className="flex items-start justify-between mb-3 pl-8">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${campaign.metadata.isPublished
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                      }`}
                  >
                    {campaign.metadata.isPublished ? 'Published' : 'Draft'}
                  </span>
                  <div className="relative" ref={openMenuId === campaign.id ? menuRef : null}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === campaign.id ? null : campaign.id);
                      }}
                      disabled={deleting === campaign.id}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 disabled:opacity-50"
                    >
                      {deleting === campaign.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                      ) : (
                        <MoreHorizontal className="h-4 w-4" />
                      )}
                    </button>
                    {openMenuId === campaign.id && (
                      <div className="absolute right-0 top-8 z-50 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                        <button
                          onClick={(e) => handleEdit(campaign.id, e)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => handleDuplicate(campaign.id, e)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Copy className="h-4 w-4" />
                          Duplicate
                        </button>
                        {campaign.metadata.isPublished && (
                          <button
                            onClick={(e) => handleUnpublish(campaign.id, e)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50"
                          >
                            <Archive className="h-4 w-4" />
                            Unpublish
                          </button>
                        )}
                        {!campaign.metadata.isPublished && (
                          <button
                            onClick={(e) => handlePublish(campaign.id, e)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50"
                          >
                            <UploadCloud className="h-4 w-4" />
                            Publish
                          </button>
                        )}
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          onClick={(e) => handleDelete(campaign.id, e)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
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
                    {campaign.metadata?.computed?.totalItems ?? campaign.items.length} modules
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
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredCampaigns.length > 0 && selectedCampaignIds.size === filteredCampaigns.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                  </th>
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
                    onClick={() => {
                      if (selectedCampaignIds.size > 0) {
                        toggleSelection(campaign.id);
                      } else {
                        router.push(`/campaign?id=${campaign.id}`);
                      }
                    }}
                    className={`cursor-pointer transition hover:bg-slate-50 ${selectedCampaignIds.has(campaign.id) ? 'bg-indigo-50/50 hover:bg-indigo-50' : ''
                      }`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedCampaignIds.has(campaign.id)}
                        onChange={() => toggleSelection(campaign.id)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${campaign.metadata.isPublished
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
                      {campaign.metadata?.computed?.totalItems ?? campaign.items.length}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-500">
                      {campaign.metadata.updatedAt
                        ? new Date(campaign.metadata.updatedAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative" ref={openMenuId === `list-${campaign.id}` ? menuRef : null}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === `list-${campaign.id}` ? null : `list-${campaign.id}`);
                          }}
                          disabled={deleting === campaign.id}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                        >
                          {deleting === campaign.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </button>
                        {openMenuId === `list-${campaign.id}` && (
                          <div className="absolute right-0 top-8 z-50 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                            <button
                              onClick={(e) => handleEdit(campaign.id, e)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              onClick={(e) => handleDuplicate(campaign.id, e)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Copy className="h-4 w-4" />
                              Duplicate
                            </button>
                            {campaign.metadata.isPublished && (
                              <button
                                onClick={(e) => handleUnpublish(campaign.id, e)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50"
                              >
                                <Archive className="h-4 w-4" />
                                Unpublish
                              </button>
                            )}
                            {!campaign.metadata.isPublished && (
                              <button
                                onClick={(e) => handlePublish(campaign.id, e)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50"
                              >
                                <UploadCloud className="h-4 w-4" />
                                Publish
                              </button>
                            )}
                            <div className="my-1 border-t border-slate-100" />
                            <button
                              onClick={(e) => handleDelete(campaign.id, e)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
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
