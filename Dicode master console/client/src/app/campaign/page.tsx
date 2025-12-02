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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/25">
                <BookOpenIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{campaign.title}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-500">
                    {campaign.items.length} video{campaign.items.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className={`text-sm ${campaign.metadata.isPublished ? 'text-emerald-600' : 'text-yellow-600'}`}>
                    {campaign.metadata.isPublished ? '● Published' : '● Draft'}
                  </span>
                </div>
              </div>
            </div>
            {campaign.description && (
              <p className="text-gray-600 mt-3 max-w-3xl">{campaign.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/campaign/edit?id=${campaign.id}`)}
              className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-semibold text-gray-700 hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-2"
            >
              <PencilIcon className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={handleTogglePublish}
              disabled={publishing}
              className={`px-4 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                campaign.metadata.isPublished
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'btn-primary'
              } disabled:opacity-50`}
            >
              {campaign.metadata.isPublished ? (
                <>
                  <ClockIcon className="w-4 h-4" />
                  Unpublish
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-4 h-4" />
                  Publish
                </>
              )}
            </button>
          </div>
        </div>

        {/* Campaign Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Skill Focus */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <BookOpenIcon className="w-6 h-6 text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Skill Focus</p>
                <p className="text-sm font-semibold text-gray-800">{campaign.skillFocus}</p>
              </div>
            </div>
          </div>

          {/* Organization Access */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <UserGroupIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Organization Access</p>
                {campaign.allowedOrganizations && campaign.allowedOrganizations.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {campaign.allowedOrganizations.map((org) => (
                      <span
                        key={org}
                        className="px-2 py-0.5 bg-purple-50 border border-purple-200 rounded text-xs text-purple-700 font-medium"
                      >
                        {org}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-gray-800">All Organizations</p>
                )}
              </div>
            </div>
          </div>

          {/* Schedule */}
          {campaign.schedule && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Schedule</p>
                  <p className="text-sm font-semibold text-gray-800 capitalize">
                    {campaign.schedule.frequency}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Schedule Details */}
        {campaign.schedule && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-gray-600" />
              Schedule Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">Start Date</p>
                <p className="text-sm text-gray-800">
                  {new Date(campaign.schedule.startDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">End Date</p>
                <p className="text-sm text-gray-800">
                  {new Date(campaign.schedule.endDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">Frequency</p>
                <p className="text-sm text-gray-800 capitalize">{campaign.schedule.frequency}</p>
              </div>
            </div>
          </div>
        )}

        {/* Automation Settings */}
        {campaign.automation && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BellIcon className="w-5 h-5 text-gray-600" />
              Automation Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded flex items-center justify-center ${campaign.anonymousResponses ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {campaign.anonymousResponses && <CheckCircleIcon className="w-4 h-4 text-green-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Anonymous Responses</p>
                  <p className="text-xs text-gray-500">Responses are kept anonymous</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded flex items-center justify-center ${campaign.automation.autoSendInvites ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {campaign.automation.autoSendInvites && <EnvelopeIcon className="w-4 h-4 text-green-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Auto-Send Invites</p>
                  <p className="text-xs text-gray-500">Automatically send invitations</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded flex items-center justify-center ${campaign.automation.sendReminders ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {campaign.automation.sendReminders && <BellIcon className="w-4 h-4 text-green-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Send Reminders</p>
                  <p className="text-xs text-gray-500">Send reminder notifications</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded flex items-center justify-center ${campaign.automation.sendConfirmations ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {campaign.automation.sendConfirmations && <ShieldCheckIcon className="w-4 h-4 text-green-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Send Confirmations</p>
                  <p className="text-xs text-gray-500">Send confirmation emails</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Organization filters are shown in the overview section above */}

        {/* Videos List */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <PlayIcon className="w-5 h-5 text-gray-600" />
            Videos in Campaign ({campaign.items.length})
          </h3>

          {campaign.items.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <PlayIcon className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 mb-4">No videos added to this campaign yet</p>
              <button
                onClick={() => router.push('/library')}
                className="px-6 py-3 btn-primary rounded-xl font-semibold transition-all inline-block"
              >
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
                    className="border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:border-gray-300 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center text-white font-semibold shadow-lg shadow-sky-500/25 flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-semibold text-gray-800 mb-1">
                          {video ? video.title : 'Loading...'}

                        </h4>
                        {video?.description && (
                          <p className="text-sm text-gray-600 mb-2">{video.description}</p>
                        )}
                        {video?.questions && video.questions.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold text-gray-700">
                              Questions ({video.questions.length})
                            </p>
                            {video.questions.map((question) => (
                              <div
                                key={question.id}
                                className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                              >
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <p className="text-sm text-gray-800 flex-1">{question.statement}</p>
                                  <span className="text-xs px-2 py-1 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-600 whitespace-nowrap">
                                    {question.type}
                                  </span>
                                </div>
                                {question.competency && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Competency: {question.competency}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Warning for legacy questions on campaign item */}
                        {item.questions && item.questions.length > 0 && (!video?.questions || video.questions.length === 0) && (
                          <div className="mt-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                            ⚠️ Questions are stored on the campaign item (legacy). They should be migrated to the video.
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
