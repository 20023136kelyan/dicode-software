'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import { Campaign, Video } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getCampaign, setCampaignPublishState, getVideo } from '@/lib/firestore';
import {
  BookOpenIcon,
  CalendarIcon,
  UserGroupIcon,
  PlayIcon,
  PencilIcon,
  CheckCircleIcon,
  ClockIcon,
  BellIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export default function CampaignDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('id');
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [videos, setVideos] = useState<Record<string, Video>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return '—';
    const parsed = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parsed);
  };

  const totalQuestions = useMemo(() => {
    if (!campaign) return 0;
    return campaign.items.reduce((sum, item) => {
      const video = videos[item.videoId];
      return sum + (video?.questions?.length || 0);
    }, 0);
  }, [campaign, videos]);

  const accessibleOrgLabel = useMemo(() => {
    if (!campaign?.allowedOrganizations || campaign.allowedOrganizations.length === 0) {
      return 'All organizations';
    }
    if (campaign.allowedOrganizations.length <= 3) {
      return campaign.allowedOrganizations.join(', ');
    }
    return `${campaign.allowedOrganizations.length} organizations`;
  }, [campaign]);

  useEffect(() => {
    if (!campaignId) {
      setError('No campaign ID provided');
      setLoading(false);
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }

    const fetchCampaign = async () => {
      try {
        const campaignData = await getCampaign(campaignId);
        if (!campaignData) {
          setError('Campaign not found');
          setLoading(false);
          return;
        }

        // Check if user owns this campaign
        if (campaignData.metadata.createdBy !== user.uid) {
          setError('You do not have access to this campaign');
          setLoading(false);
          return;
        }

        setCampaign(campaignData);

        // Fetch videos for all campaign items
        const videoMap: Record<string, Video> = {};
        for (const item of campaignData.items) {
          const video = await getVideo(item.videoId);
          if (video) {
            videoMap[item.videoId] = video;
          }
        }
        setVideos(videoMap);
      } catch (err: any) {
        console.error('Failed to fetch campaign:', err);
        setError(err?.message || 'Failed to load campaign');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId, user]);

  const handleTogglePublish = async () => {
    if (!campaign) return;

    setPublishing(true);
    try {
      const newPublishState = !campaign.metadata.isPublished;
      await setCampaignPublishState(campaign.id, newPublishState);
      setCampaign({
        ...campaign,
        metadata: {
          ...campaign.metadata,
          isPublished: newPublishState,
        },
      });
    } catch (err: any) {
      console.error('Failed to update publish state:', err);
      alert('Failed to update campaign status');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }  if (error || !campaign) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/20 flex items-center justify-center mb-4">
              <BookOpenIcon className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {error || 'Campaign not found'}
            </h3>
            <button
              onClick={() => router.push('/campaigns')}
              className="px-6 py-3 btn-primary rounded-xl font-semibold transition-all inline-block mt-4"
            >
              Back to Campaigns
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8 text-slate-900">
        {/* Hero Header */}
        <section className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-8 shadow-xl shadow-slate-100">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                  <BookOpenIcon className="h-7 w-7" />
              </div>
              <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-semibold text-slate-900">{campaign.title}</h1>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      campaign.metadata.isPublished 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {campaign.metadata.isPublished ? 'Published' : 'Draft'}
                  </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {campaign.items.length} video{campaign.items.length !== 1 ? 's' : ''} • Created {formatDate(campaign.metadata.createdAt)}
                  </p>
              </div>
            </div>
            {campaign.description && (
                <p className="text-slate-600 max-w-2xl">{campaign.description}</p>
            )}
              <div className="flex flex-wrap gap-3">
            <button
              onClick={() => router.push(`/campaign/edit?id=${campaign.id}`)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:shadow-sm"
            >
                  <PencilIcon className="h-4 w-4" />
                  Edit Campaign
            </button>
            <button
              onClick={handleTogglePublish}
              disabled={publishing}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                campaign.metadata.isPublished
                      ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      : 'bg-slate-900 text-white shadow-[0_15px_45px_rgba(15,23,42,0.25)] hover:brightness-110'
                  }`}
            >
              {campaign.metadata.isPublished ? (
                <>
                      <ClockIcon className="h-4 w-4" />
                  Unpublish
                </>
              ) : (
                <>
                      <CheckCircleIcon className="h-4 w-4" />
                      Publish Campaign
                </>
              )}
            </button>
          </div>
        </div>

            <div className="grid w-full max-w-sm gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-center shadow-sm">
                <p className="text-3xl font-semibold text-slate-900">{campaign.items.length}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.35em] text-slate-400">Videos</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-center shadow-sm">
                <p className="text-3xl font-semibold text-slate-900">{totalQuestions}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.35em] text-slate-400">Questions</p>
              </div>
            </div>
          </div>
        </section>

        {/* Campaign Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Skill Focus */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100">
                <BookOpenIcon className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Skill Focus</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{campaign.skillFocus}</p>
              </div>
            </div>
          </div>

          {/* Organization Access */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100">
                <UserGroupIcon className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Organization Access</p>
                {campaign.allowedOrganizations && campaign.allowedOrganizations.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {campaign.allowedOrganizations.slice(0, 3).map((org) => (
                      <span
                        key={org}
                        className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-xs font-medium text-violet-700"
                      >
                        {org}
                      </span>
                    ))}
                    {campaign.allowedOrganizations.length > 3 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        +{campaign.allowedOrganizations.length - 3} more
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-slate-900">All Organizations</p>
                )}
              </div>
            </div>
          </div>

          {/* Schedule */}
          {campaign.schedule && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
                  <CalendarIcon className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Schedule</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 capitalize">
                    {campaign.schedule.frequency}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Schedule Details */}
        {campaign.schedule && (
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 mb-5 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-slate-400" />
              Schedule Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Start Date</p>
                <p className="text-sm font-medium text-slate-900">
                  {formatDate(campaign.schedule.startDate)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">End Date</p>
                <p className="text-sm font-medium text-slate-900">
                  {formatDate(campaign.schedule.endDate)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Frequency</p>
                <p className="text-sm font-medium text-slate-900 capitalize">{campaign.schedule.frequency}</p>
              </div>
            </div>
          </div>
        )}

        {/* Automation Settings */}
        {campaign.automation && (
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 mb-5 flex items-center gap-2">
              <BellIcon className="h-5 w-5 text-slate-400" />
              Automation Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${campaign.anonymousResponses ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  {campaign.anonymousResponses ? (
                    <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <ShieldCheckIcon className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Anonymous Responses</p>
                  <p className="text-xs text-slate-500">Responses are kept anonymous</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${campaign.automation.autoSendInvites ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  {campaign.automation.autoSendInvites ? (
                    <EnvelopeIcon className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <EnvelopeIcon className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Auto-Send Invites</p>
                  <p className="text-xs text-slate-500">Automatically send invitations</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${campaign.automation.sendReminders ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  {campaign.automation.sendReminders ? (
                    <BellIcon className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <BellIcon className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Send Reminders</p>
                  <p className="text-xs text-slate-500">Send reminder notifications</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${campaign.automation.sendConfirmations ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  {campaign.automation.sendConfirmations ? (
                    <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <ShieldCheckIcon className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Send Confirmations</p>
                  <p className="text-xs text-slate-500">Send confirmation emails</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Videos List */}
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-5 flex items-center gap-2">
            <PlayIcon className="h-5 w-5 text-slate-400" />
            Videos in Campaign ({campaign.items.length})
          </h3>

          {campaign.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <PlayIcon className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 mb-4">No videos added to this campaign yet</p>
              <button
                onClick={() => router.push('/videos')}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_15px_45px_rgba(15,23,42,0.25)] transition hover:brightness-110"
              >
                <SparklesIcon className="h-4 w-4" />
                Add Videos from Library
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {campaign.items.map((item, index) => {
                const video = videos[item.videoId];
                return (
                  <div
                    key={item.id}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-lg">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-semibold text-slate-900 mb-1">
                          {video ? video.title : 'Loading...'}
                        </h4>
                        {video?.description && (
                          <p className="text-sm text-slate-500 mb-3">{video.description}</p>
                        )}
                        {video?.questions && video.questions.length > 0 && (
                          <div className="mt-4 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Questions ({video.questions.length})
                            </p>
                            {video.questions.map((question) => (
                              <div
                                key={question.id}
                                className="rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                              >
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <p className="text-sm text-slate-700 flex-1">{question.statement}</p>
                                  <span className="rounded-full bg-sky-100 border border-sky-200 px-2.5 py-0.5 text-xs font-medium text-sky-700 whitespace-nowrap">
                                    {question.type}
                                  </span>
                                </div>
                                {question.competency && (
                                  <p className="text-xs text-slate-400">
                                    Competency: {question.competency}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Warning for legacy questions on campaign item */}
                        {item.questions && item.questions.length > 0 && (!video?.questions || video.questions.length === 0) && (
                          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                            <span>⚠️</span>
                            <span>Questions are stored on the campaign item (legacy). They should be migrated to the video.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
