'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Search,
  Building2,
  Filter,
  Check,
  Edit2,
  Users,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, doc, updateDoc, query, orderBy, where, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import MainLayout from '@/components/Layout/MainLayout';
import CollapsibleHero from '@/components/Layout/CollapsibleHero';
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

  // Store full organization objects fetched from Firestore
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
      console.log('🏢 Loaded organizations:', orgs);
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

  // Create a map for easy name lookup
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
    try {
      const campaignRef = doc(db, 'campaigns', campaignId);
      await updateDoc(campaignRef, {
        allowedOrganizations: organizations.length > 0 ? organizations : null,
        'metadata.updatedAt': new Date(),
      });

      setCampaigns(campaigns.map(c =>
        c.id === campaignId
          ? { ...c, allowedOrganizations: organizations.length > 0 ? organizations : undefined }
          : c
      ));

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

    // For now, we just add the string ID. 
    // Ideally, this should create a new Organization document or search for one.
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

  const publishedCount = campaigns.filter((campaign) => campaign.metadata.isPublished).length;
  const restrictedCount = campaigns.filter((campaign) => campaign.allowedOrganizations?.length).length;

  const emptyState = (
    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-200 bg-white p-12 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Building2 className="h-8 w-8" />
      </div>
      <h3 className="text-xl font-semibold text-slate-800 mb-2">
        {searchTerm ? 'No access results match' : 'No campaigns available'}
      </h3>
      <p className="text-slate-500 max-w-md">
        {searchTerm
          ? 'Try adjusting your search or filters.'
          : 'Launch a campaign first, then return here to manage organization-level access.'}
      </p>
    </div>
  );

  const content = (
    <div className="space-y-8 text-slate-900">
      <CollapsibleHero>
        <section className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-8 shadow-xl shadow-slate-100">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Access Control</p>
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
                Decide which organizations can enter each DiCode program.
              </h1>
              <p className="text-slate-600 max-w-2xl">
                Keep leadership cohorts private, open up onboarding modules, and maintain governance in one modern,
                DiCode-style dashboard.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => router.push('/campaigns/new')}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_15px_45px_rgba(15,23,42,0.25)] transition hover:brightness-110"
                >
                  <Sparkles className="h-4 w-4" />
                  Create new campaign
                </button>
              </div>
            </div>
            <div className="grid w-full max-w-xl gap-4 grid-cols-2 sm:grid-cols-2">
              <StatCard value={campaigns.length} label="Campaigns" sublabel="total programs" />
              <StatCard value={publishedCount} label="Published" sublabel="live cohorts" />
              <StatCard value={restrictedCount} label="Restricted" sublabel="org-specific" />
            </div>
          </div>
        </section>
      </CollapsibleHero>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-5 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search campaigns…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 border-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filterPublished}
              onChange={(e) => setFilterPublished(e.target.value as any)}
              className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">All campaigns</option>
              <option value="published">Published only</option>
              <option value="draft">Drafts only</option>
            </select>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-slate-600" />
            <div className="text-sm text-slate-600">
              <p className="font-semibold text-slate-900 mb-1">Access rules</p>
              <ul className="space-y-1">
                <li>Campaigns without organizations are visible to all employees.</li>
                <li>Assign one or more organizations to restrict access.</li>
                <li>Teammates without an org tag can only see open campaigns.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {filteredCampaigns.length === 0 ? (
          emptyState
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">Campaign</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Organizations</th>
                  <th className="px-6 py-4 text-center">Modules</th>
                  <th className="px-6 py-4 text-right">Updated</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCampaigns.map((campaign) => (
                  <Fragment key={campaign.id}>
                    <tr className="transition hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{campaign.title}</div>
                        {campaign.description && (
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{campaign.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${campaign.metadata.isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                            }`}
                        >
                          {campaign.metadata.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {campaign.allowedOrganizations && campaign.allowedOrganizations.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {campaign.allowedOrganizations.slice(0, 3).map((orgId) => (
                              <span
                                key={orgId}
                                className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                              >
                                {getOrganizationName(orgId)}
                              </span>
                            ))}
                            {campaign.allowedOrganizations.length > 3 && (
                              <span className="text-[11px] text-slate-400">
                                +{campaign.allowedOrganizations.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                            <Check className="h-3 w-3 text-emerald-500" />
                            All orgs
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-600 tabular-nums">
                        {campaign.itemIds?.length || 0}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500 tabular-nums">
                        {campaign.metadata.updatedAt?.toDate
                          ? campaign.metadata.updatedAt.toDate().toLocaleDateString()
                          : campaign.metadata.updatedAt?.toDateString?.() || '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {editingCampaign === campaign.id ? (
                          <button
                            onClick={() => setEditingCampaign(null)}
                            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingCampaign(campaign.id)}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                    {editingCampaign === campaign.id && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={6} className="px-6 py-5">
                          <div className="space-y-4">
                            <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-slate-500" />
                              Organization access
                            </div>
                            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                              {availableOrganizations.map((org) => {
                                const isSelected = campaign.allowedOrganizations?.includes(org.id) ?? false;
                                return (
                                  <label
                                    key={org.id}
                                    className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition ${isSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
                                      }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        const updated = toggleOrganization(campaign, org.id);
                                        handleUpdateAccess(campaign.id, updated);
                                      }}
                                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                                    />
                                    {org.name}
                                  </label>
                                );
                              })}
                            </div>
                            <div className="flex flex-col gap-2 md:flex-row">
                              <input
                                type="text"
                                placeholder="Add custom organization ID…"
                                value={organizationInput}
                                onChange={(e) => setOrganizationInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addCustomOrganization(campaign);
                                  }
                                }}
                                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-100"
                              />
                              <button
                                onClick={() => addCustomOrganization(campaign)}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                              >
                                Add
                              </button>
                            </div>
                            <p className="text-xs text-slate-500">
                              Note: Adding a custom ID will not create a new organization entity, but will allow access for users with that organization ID.
                            </p>
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

        {!user && (
          <div className="flex items-center gap-3 rounded-[28px] border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <Lock className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Sign in to manage campaign access.</p>
          </div>
        )}
      </section>

      {/* Edit Modal handled below */}
    </div>
  );

  if (!user) {
    return (
      <MainLayout>
        {content}
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {content}
    </MainLayout>
  );
}

function StatCard({ value, label, sublabel }: { value: number; label: string; sublabel: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-center shadow-sm">
      <p className="text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-[0.65rem] uppercase tracking-[0.25em] text-slate-400 leading-tight break-words whitespace-normal">
        {label}
      </p>
      <p className="mt-1 text-xs text-slate-500 break-words whitespace-normal">{sublabel}</p>
    </div>
  );
}
