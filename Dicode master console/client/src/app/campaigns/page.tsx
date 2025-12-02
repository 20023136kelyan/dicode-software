'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import CollapsibleHero from '@/components/Layout/CollapsibleHero';
import { Campaign } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getCampaignsByUser } from '@/lib/firestore';
import {
  LayoutGrid,
  Rows,
  Shield,
  Sparkles,
  CirclePlus,
  Layers3,
  Search,
} from 'lucide-react';

type ViewMode = 'grid' | 'list';

export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const statusFilter = searchParams.get('status') || 'all';

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

  const filteredCampaigns = campaigns.filter(
    (campaign) => {
      // Search filter
      const matchesSearch = campaign.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.skillFocus.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'published' && campaign.metadata.isPublished) ||
        (statusFilter === 'draft' && !campaign.metadata.isPublished);

      return matchesSearch && matchesStatus;
    }
  );

  const publishedCount = campaigns.filter((campaign) => campaign.metadata.isPublished).length;
  const draftCount = campaigns.length - publishedCount;

  return (
    <MainLayout>
      <div className="space-y-8 text-slate-900">
        <CollapsibleHero showManualCollapse>
          <section className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-8 shadow-xl shadow-slate-100">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Campaign HQ</p>
                <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
                  Shape DiCode programs with the same polish as creation.
                </h1>
                <p className="text-slate-600 max-w-2xl">
                  Browse, filter, and activate your behavior campaigns with the refreshed UI that mirrors the video
                  generator—minimal, data-rich, and collaboration-ready.
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

              <div className="grid w-full max-w-xl gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-center shadow-sm">
                  <p className="text-3xl font-semibold text-slate-900">{campaigns.length}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.35em] text-slate-400">Total</p>
                  <p className="mt-1 text-xs text-slate-500">active campaigns</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-center shadow-sm">
                  <p className="text-3xl font-semibold text-slate-900">{publishedCount}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.35em] text-slate-400">Published</p>
                  <p className="mt-1 text-xs text-slate-500">live programs</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-center shadow-sm">
                  <p className="text-3xl font-semibold text-slate-900">{draftCount}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.35em] text-slate-400">Drafts</p>
                  <p className="mt-1 text-xs text-slate-500">in progress</p>
                </div>
              </div>
            </div>
          </section>
        </CollapsibleHero>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-5 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search titles, descriptions, or skill focus…"
                  className="flex-1 border-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-1 py-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Rows className="h-4 w-4" />
                List
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(['all', 'published', 'draft'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set('status', filter);
                  router.push(`/campaigns?${params.toString()}`);
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  statusFilter === filter
                    ? 'bg-slate-900 text-white shadow-[0_10px_30px_rgba(15,23,42,0.25)]'
                    : 'border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          {loading ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-[32px] border border-slate-200 bg-white">
              <div className="h-10 w-10 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin" />
              <p className="text-sm text-slate-500">Gathering your campaigns…</p>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-200 bg-white text-center p-12">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Layers3 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                {campaigns.length === 0 ? 'No campaigns launched yet' : 'No results for your filters'}
              </h3>
              <p className="text-slate-500 max-w-md">
                {campaigns.length === 0
                  ? 'Start by designing a leadership or enablement program—import your best Sora outputs and roll them into a measurable campaign.'
                  : 'Try updating your search or status filters, or spin up a fresh campaign.'}
              </p>
              {campaigns.length === 0 && user && (
                <button
                  onClick={() => router.push('/campaigns/new')}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_15px_45px_rgba(15,23,42,0.25)] transition hover:brightness-110"
                >
                  <Sparkles className="h-4 w-4" />
                  Create your first campaign
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  onClick={() => router.push(`/campaign?id=${campaign.id}`)}
                  className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        campaign.metadata.isPublished ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {campaign.metadata.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-900 line-clamp-1">{campaign.title}</h3>
                  <p className="mt-2 text-sm text-slate-500 line-clamp-3">{campaign.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-700">
                      {campaign.skillFocus}
                    </span>
                    <span>{campaign.items.length} modules</span>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
                    <span>Updated {campaign.metadata.updatedAt.toDateString?.() ?? ''}</span>
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Shield className="h-3.5 w-3.5" />
                      {campaign.metadata.tags?.length || 0} tags
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Campaign</th>
                    <th className="px-6 py-4">Skill Focus</th>
                    <th className="px-6 py-4 text-center">Modules</th>
                    <th className="px-6 py-4 text-right">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCampaigns.map((campaign) => (
                    <tr
                      key={campaign.id}
                      onClick={() => router.push(`/campaign?id=${campaign.id}`)}
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            campaign.metadata.isPublished
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {campaign.metadata.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-slate-900">{campaign.title}</div>
                          <div className="text-xs text-slate-500 line-clamp-1">{campaign.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          {campaign.skillFocus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-600">
                        {campaign.items.length}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500">
                        {campaign.metadata.updatedAt ? new Date(campaign.metadata.updatedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!user && (
            <div className="flex items-center gap-3 rounded-[28px] border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <Shield className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">Please sign in to create and manage campaigns.</p>
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
