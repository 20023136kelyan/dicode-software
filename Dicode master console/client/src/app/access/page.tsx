'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Search,
  Building2,
  Check,
  Edit2,
  Lock,
  Plus,
  X,
  CheckCircle,
  Video as VideoIcon,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logActivity, bulkUpdateVideoAccess, bulkUpdateCampaignAccess, getAllCampaignsList } from '@/lib/firestore'; // Import batch functions and list fetch
import MainLayout from '@/components/Layout/MainLayout';
import type { Organization, Video } from '@/lib/types';
import BulkAccessModal from '@/components/BulkAccessModal'; // Import the generic modal

// LocalInterfaces
interface Campaign {
  id: string;
  title: string;
  description: string;
  allowedOrganizations?: string[];
  metadata: {
    isPublished: boolean;
    createdAt: any;
    updatedAt: any;
  };
  itemIds?: string[];
}

type ActiveTab = 'campaigns' | 'videos';

export default function AccessManagementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { error: showError, success: showSuccess } = useNotification();

  // Data State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [availableOrganizations, setAvailableOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [activeTab, setActiveTab] = useState<ActiveTab>('campaigns');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPublished, setFilterPublished] = useState<'all' | 'published' | 'draft'>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'generated' | 'uploaded'>('all');

  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [organizationInput, setOrganizationInput] = useState('');

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkAccessModal, setShowBulkAccessModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // clear selection when tab changes
  useEffect(() => {
    setSelectedIds(new Set());
    setSearchTerm('');
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCampaigns(), loadVideos(), loadOrganizations()]);
    } catch (error) {
      console.error('Failed to load data:', error);
      showError('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const q = query(collection(db, 'organizations'), orderBy('name'));
      const snapshot = await getDocs(q);
      const orgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Organization[];
      setAvailableOrganizations(orgs);
    } catch (error) {
      console.error('Failed to load organizations:', error);
    }
  };

  const loadCampaigns = async () => {
    try {
      const campaignsData = await getAllCampaignsList();
      setCampaigns(campaignsData);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    }
  };

  const loadVideos = async () => {
    try {
      const q = query(collection(db, 'videos'), orderBy('metadata.createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const videosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Video[];
      setVideos(videosData);
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  };

  const organizationNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    availableOrganizations.forEach(org => {
      map[org.id] = org.name;
    });
    return map;
  }, [availableOrganizations]);

  const getOrganizationName = (orgId: string): string => {
    return organizationNameMap[orgId] || orgId;
  };

  // Generic Update Handler
  const handleUpdateAccess = async (itemId: string, organizations: string[], type: 'campaign' | 'video') => {
    if (!user) return;

    try {
      const collectionName = type === 'campaign' ? 'campaigns' : 'videos';
      const docRef = doc(db, collectionName, itemId);

      const updateData = {
        allowedOrganizations: organizations.length > 0 ? organizations : null,
        'metadata.updatedAt': new Date(),
      };

      await updateDoc(docRef, updateData);

      if (type === 'campaign') {
        setCampaigns(prev => prev.map(c =>
          c.id === itemId ? { ...c, allowedOrganizations: organizations.length > 0 ? organizations : undefined } : c
        ));
      } else {
        setVideos(prev => prev.map(v =>
          v.id === itemId ? { ...v, allowedOrganizations: organizations.length > 0 ? organizations : undefined } : v
        ));
      }

      await logActivity({
        action: 'access_updated',
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || undefined,
        resourceId: itemId,
        resourceName: type === 'campaign'
          ? campaigns.find(c => c.id === itemId)?.title || 'Unknown'
          : videos.find(v => v.id === itemId)?.title || 'Unknown',
        resourceType: 'access',
        metadata: { organizationsCount: organizations.length, type },
      });

      setEditingItem(null);
      showSuccess('Access Updated', `${type === 'campaign' ? 'Campaign' : 'Video'} access updated.`);
    } catch (error) {
      console.error(`Failed to update ${type} access:`, error);
      showError('Update Failed', `Failed to update ${type} access.`);
    }
  };

  // Bulk Handlers
  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handleBulkAccessUpdate = async (allowedOrganizations: string[]) => {
    if (!user) return;

    try {
      if (activeTab === 'videos') {
        await bulkUpdateVideoAccess(Array.from(selectedIds), allowedOrganizations);
        await loadVideos();
      } else {
        await bulkUpdateCampaignAccess(Array.from(selectedIds), allowedOrganizations);
        await loadCampaigns();
      }

      setSelectedIds(new Set());
      setShowBulkAccessModal(false);
      showSuccess('Success', `Bulk updated access for ${selectedIds.size} items`);

      // Log bulk activity
      await logActivity({
        action: 'bulk_access_updated',
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || undefined,
        resourceId: 'bulk',
        resourceName: 'Bulk Update',
        resourceType: 'access',
        metadata: { count: selectedIds.size, type: activeTab, allowedOrganizations },
      });

    } catch (error) {
      console.error('Failed to bulk update access:', error);
      showError('Error', 'Failed to update access settings');
    }
  };


  const toggleOrganization = (item: Campaign | Video, orgId: string, type: 'campaign' | 'video') => {
    const current = item.allowedOrganizations || [];
    const updated = current.includes(orgId)
      ? current.filter(o => o !== orgId)
      : [...current, orgId];
    return updated;
  };

  const addCustomOrganization = (item: Campaign | Video, type: 'campaign' | 'video') => {
    if (!organizationInput.trim()) return;

    const newOrgId = organizationInput.trim();
    const current = item.allowedOrganizations || [];
    if (!current.includes(newOrgId)) {
      const updated = [...current, newOrgId];
      handleUpdateAccess(item.id, updated, type);
    }
    setOrganizationInput('');
  };

  // Stats
  const activeStats = useMemo(() => {
    if (activeTab === 'campaigns') {
      const total = campaigns.length;
      const published = campaigns.filter(c => c.metadata.isPublished).length;
      const restricted = campaigns.filter(c => c.allowedOrganizations?.length).length;
      return { total, secondMetric: published, secondLabel: 'Published', restricted, restrictedLabel: 'Restricted Campaigns' };
    } else {
      const total = videos.length;
      const generated = videos.filter(v => v.source === 'generated').length;
      const restricted = videos.filter(v => v.allowedOrganizations?.length).length;
      return { total, secondMetric: generated, secondLabel: 'AI Generated', restricted, restrictedLabel: 'Restricted Videos' };
    }
  }, [activeTab, campaigns, videos]);

  // Filtering
  const filteredItems = useMemo(() => {
    if (activeTab === 'campaigns') {
      return campaigns.filter(campaign => {
        const matchesSearch = campaign.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          campaign.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterPublished === 'all'
          ? true
          : filterPublished === 'published' ? campaign.metadata.isPublished : !campaign.metadata.isPublished;
        return matchesSearch && matchesStatus;
      });
    } else {
      return videos.filter(video => {
        const matchesSearch = video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          video.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSource = filterSource === 'all'
          ? true
          : video.source === filterSource;
        return matchesSearch && matchesSource;
      });
    }
  }, [activeTab, campaigns, videos, searchTerm, filterPublished, filterSource]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin" />
          <p className="mt-4 text-sm text-slate-500">Loading access settings...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 relative">

        {/* Bulk Action Toolbar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-3 shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-3 border-r border-slate-100 pr-4">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {selectedIds.size}
              </span>
              <span className="text-sm font-medium text-slate-700">Selected</span>
            </div>

            <button
              onClick={() => setShowBulkAccessModal(true)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <Shield className="h-4 w-4" />
              Edit Access
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <BulkAccessModal
          isOpen={showBulkAccessModal}
          onClose={() => setShowBulkAccessModal(false)}
          onSave={handleBulkAccessUpdate}
          selectedCount={selectedIds.size}
        />

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          <button
            onClick={() => { setActiveTab('campaigns'); setSearchTerm(''); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'campaigns' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Campaigns
          </button>
          <button
            onClick={() => { setActiveTab('videos'); setSearchTerm(''); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'videos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Videos
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                {activeTab === 'campaigns' ? <Shield className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{activeStats.total}</p>
                <p className="text-xs text-slate-500">Total {activeTab === 'campaigns' ? 'Campaigns' : 'Videos'}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{activeStats.secondMetric}</p>
                <p className="text-xs text-slate-500">{activeStats.secondLabel}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{activeStats.restricted}</p>
                <p className="text-xs text-slate-500">{activeStats.restrictedLabel}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-900 mb-1">Access rules</p>
              <ul className="space-y-0.5 text-slate-500">
                <li>• Items without organizations are visible to all employees</li>
                <li>• Assign organizations to restrict access to specific groups</li>
                <li>• Users without an org tag can only see open/global items</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
              {activeTab === 'campaigns' ? (
                (['all', 'published', 'draft'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setFilterPublished(filter)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${filterPublished === filter
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))
              ) : (
                (['all', 'generated', 'uploaded'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setFilterSource(filter)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${filterSource === filter
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${activeTab}...`}
                className="h-9 w-64 rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 transition focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
              />
            </div>

            {/* Action Button - Dynamic */}
            <button
              onClick={() => router.push(activeTab === 'campaigns' ? '/campaigns/new' : '/videos')}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New {activeTab === 'campaigns' ? 'Campaign' : 'Video'}
            </button>
          </div>
        </div>

        {/* Content Table */}
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-4">
              {activeTab === 'campaigns' ? <Building2 className="h-7 w-7" /> : <VideoIcon className="h-7 w-7" />}
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              {activeTab === 'campaigns' && campaigns.length === 0 ? 'No campaigns yet' :
                activeTab === 'videos' && videos.length === 0 ? 'No videos yet' :
                  `No matching ${activeTab}`}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm">
              Try adjusting your search or filters.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {activeTab === 'campaigns' ? 'Campaign' : 'Video'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {activeTab === 'campaigns' ? 'Status' : 'Source'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Organizations
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {activeTab === 'campaigns' ? 'Modules' : 'Questions'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Updated
                  </th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const isCampaign = activeTab === 'campaigns';
                  const campaign = isCampaign ? item as Campaign : null;
                  const video = !isCampaign ? item as Video : null;

                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={`transition hover:bg-slate-50 ${selectedIds.has(item.id) ? 'bg-indigo-50/50 hover:bg-indigo-50' : ''}`}
                        onClick={() => toggleSelection(item.id)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelection(item.id)}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-900">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isCampaign ? (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${campaign!.metadata.isPublished
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                              }`}>
                              {campaign!.metadata.isPublished ? 'Published' : 'Draft'}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${video!.source === 'generated'
                              ? 'bg-violet-100 text-violet-700'
                              : 'bg-sky-100 text-sky-700'
                              }`}>
                              {video!.source === 'generated' ? 'AI Generated' : 'Uploaded'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.allowedOrganizations && item.allowedOrganizations.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.allowedOrganizations.slice(0, 2).map((orgId) => (
                                <span
                                  key={orgId}
                                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                                >
                                  {getOrganizationName(orgId)}
                                </span>
                              ))}
                              {item.allowedOrganizations.length > 2 && (
                                <span className="text-xs text-slate-400">
                                  +{item.allowedOrganizations.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Check className="h-3 w-3 text-emerald-500" />
                              All organizations
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600">
                          {isCampaign ? (campaign!.itemIds?.length || 0) : (video!.questions?.length || 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-500">
                          {item.metadata.updatedAt ? new Date(
                            (item.metadata.updatedAt as any).toDate
                              ? (item.metadata.updatedAt as any).toDate()
                              : item.metadata.updatedAt
                          ).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {editingItem === item.id ? (
                            <button
                              onClick={() => setEditingItem(null)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setEditingItem(item.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
                            >
                              <Edit2 className="h-3 w-3" />
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Edit Row */}
                      {editingItem === item.id && (
                        <tr className="bg-slate-50">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                                <Building2 className="h-4 w-4 text-slate-500" />
                                Select organizations with access for "{item.title}"
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {availableOrganizations.map((org) => {
                                  const isSelected = item.allowedOrganizations?.includes(org.id) ?? false;
                                  return (
                                    <button
                                      key={org.id}
                                      onClick={() => {
                                        const updated = toggleOrganization(item as any, org.id, isCampaign ? 'campaign' : 'video');
                                        handleUpdateAccess(item.id, updated, isCampaign ? 'campaign' : 'video');
                                      }}
                                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${isSelected
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                        }`}
                                    >
                                      {isSelected && <Check className="h-3.5 w-3.5" />}
                                      {org.name}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Add custom organization ID..."
                                  value={organizationInput}
                                  onChange={(e) => setOrganizationInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      addCustomOrganization(item as any, isCampaign ? 'campaign' : 'video');
                                    }
                                  }}
                                  className="flex-1 max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                                />
                                <button
                                  onClick={() => addCustomOrganization(item as any, isCampaign ? 'campaign' : 'video')}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
