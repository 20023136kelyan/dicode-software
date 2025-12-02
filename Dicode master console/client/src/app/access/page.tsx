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
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logActivity } from '@/lib/firestore';
import MainLayout from '@/components/Layout/MainLayout';
import type { Organization } from '@/lib/types';

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

export default function AccessManagementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPublished, setFilterPublished] = useState<'all' | 'published' | 'draft'>('all');
  const [editingCampaign, setEditingCampaign] = useState<string | null>(null);
  const [organizationInput, setOrganizationInput] = useState('');
  const [availableOrganizations, setAvailableOrganizations] = useState<Organization[]>([]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCampaigns(), loadOrganizations()]);
    } catch (error) {
      console.error('Failed to load data:', error);
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
      const q = query(collection(db, 'campaigns'), orderBy('metadata.updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      const campaignsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Campaign[];
      setCampaigns(campaignsData);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
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

  const handleUpdateAccess = async (campaignId: string, organizations: string[]) => {
    if (!user) return;

    try {
      const campaignRef = doc(db, 'campaigns', campaignId);
      await updateDoc(campaignRef, {
        allowedOrganizations: organizations.length > 0 ? organizations : null,
        'metadata.updatedAt': new Date(),
      });

      const campaign = campaigns.find(c => c.id === campaignId);

      setCampaigns(campaigns.map(c =>
        c.id === campaignId
          ? { ...c, allowedOrganizations: organizations.length > 0 ? organizations : undefined }
          : c
      ));

      await logActivity({
        action: 'access_updated',
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || undefined,
        resourceId: campaignId,
        resourceName: campaign?.title || 'Unknown Campaign',
        resourceType: 'access',
        metadata: { organizationsCount: organizations.length },
      });

      setEditingCampaign(null);
    } catch (error) {
      console.error('Failed to update campaign access:', error);
      alert('Failed to update access settings');
    }
  };

  const toggleOrganization = (campaign: Campaign, orgId: string) => {
    const current = campaign.allowedOrganizations || [];
    const updated = current.includes(orgId)
      ? current.filter(o => o !== orgId)
      : [...current, orgId];
    return updated;
  };

  const addCustomOrganization = (campaign: Campaign) => {
    if (!organizationInput.trim()) return;

    const newOrgId = organizationInput.trim();
    const current = campaign.allowedOrganizations || [];
    if (!current.includes(newOrgId)) {
      const updated = [...current, newOrgId];
      handleUpdateAccess(campaign.id, updated);
    }
    setOrganizationInput('');
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPublished = filterPublished === 'all'
      ? true
      : filterPublished === 'published'
        ? campaign.metadata.isPublished
        : !campaign.metadata.isPublished;

    return matchesSearch && matchesPublished;
  });

  const publishedCount = campaigns.filter((c) => c.metadata.isPublished).length;
  const restrictedCount = campaigns.filter((c) => c.allowedOrganizations?.length).length;

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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Access Control</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage organization-level permissions for campaigns
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
                <Shield className="h-5 w-5" />
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
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{restrictedCount}</p>
                <p className="text-xs text-slate-500">Restricted</p>
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
                <li>• Campaigns without organizations are visible to all employees</li>
                <li>• Assign organizations to restrict access to specific groups</li>
                <li>• Users without an org tag can only see open campaigns</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
              {(['all', 'published', 'draft'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setFilterPublished(filter)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    filterPublished === filter
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search campaigns..."
              className="h-9 w-64 rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 transition focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        {/* Content */}
        {filteredCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-4">
              <Building2 className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              {campaigns.length === 0 ? 'No campaigns yet' : 'No matching campaigns'}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm">
              {campaigns.length === 0
                ? 'Create a campaign first, then return here to manage access.'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Campaign
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Organizations
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Modules
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Updated
                  </th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCampaigns.map((campaign) => (
                  <Fragment key={campaign.id}>
                    <tr className="transition hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{campaign.title}</p>
                        {campaign.description && (
                          <p className="text-xs text-slate-500 line-clamp-1">{campaign.description}</p>
                        )}
                      </td>
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
                        {campaign.allowedOrganizations && campaign.allowedOrganizations.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {campaign.allowedOrganizations.slice(0, 2).map((orgId) => (
                              <span
                                key={orgId}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                              >
                                {getOrganizationName(orgId)}
                              </span>
                            ))}
                            {campaign.allowedOrganizations.length > 2 && (
                              <span className="text-xs text-slate-400">
                                +{campaign.allowedOrganizations.length - 2}
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
                        {campaign.itemIds?.length || 0}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-500">
                        {campaign.metadata.updatedAt?.toDate
                          ? campaign.metadata.updatedAt.toDate().toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {editingCampaign === campaign.id ? (
                          <button
                            onClick={() => setEditingCampaign(null)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingCampaign(campaign.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Edit Row */}
                    {editingCampaign === campaign.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                              <Building2 className="h-4 w-4 text-slate-500" />
                              Select organizations with access
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {availableOrganizations.map((org) => {
                                const isSelected = campaign.allowedOrganizations?.includes(org.id) ?? false;
                                return (
                                  <button
                                    key={org.id}
                                    onClick={() => {
                                      const updated = toggleOrganization(campaign, org.id);
                                      handleUpdateAccess(campaign.id, updated);
                                    }}
                                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                      isSelected
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
                                    addCustomOrganization(campaign);
                                  }
                                }}
                                className="flex-1 max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                              />
                              <button
                                onClick={() => addCustomOrganization(campaign)}
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Auth Warning */}
        {!user && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
              <Lock className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Please sign in to manage campaign access.</p>
          </div>
        )}
        </div>
    </MainLayout>
  );
}
