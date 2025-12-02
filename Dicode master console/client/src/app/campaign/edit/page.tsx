'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import MainLayout from '@/components/Layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  getCampaign,
  updateCampaign,
  batchDeleteCampaignItems,
  getAllVideos,
  createCampaignItem,
  getVideo,
  setCampaignPublishState
} from '@/lib/firestore';
import { type CompetencyDefinition, type SkillDefinition } from '@/lib/competencies';
import { useCompetencies } from '@/hooks/useCompetencies';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  Info,
  Mail,
  Play,
  Save,
  Search,
  Loader2,
  MoveUp,
  MoveDown,
  X,
} from 'lucide-react';
import type { Organization, Video, Campaign } from '@/lib/types';

type Skill = SkillDefinition;
type Competency = CompetencyDefinition;

const wizardSteps = [
  { id: 1, label: 'Campaign Setup', description: 'Goals, competencies, and skills' },
  { id: 2, label: 'Audience', description: 'Select cohorts and guardrails' },
  { id: 3, label: 'Schedule', description: 'Timing + automation' },
];

const frequencyOptions = ['once', 'weekly', 'monthly', 'quarterly'] as const;

const formatVideoDuration = (seconds?: number) => {
  if (seconds === undefined || seconds === null) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const defaultForm = {
  name: '',
  description: '',
  targetCompetencies: [] as string[],
  selectedSkills: {} as Record<string, string[]>,
  allowedOrganizations: [] as string[],
  anonymousResponses: true,
  startDate: '',
  endDate: '',
  frequency: 'monthly' as (typeof frequencyOptions)[number],
  autoSendInvites: true,
  sendReminders: true,
  sendConfirmations: true,
};

export default function EditCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('id');
  const { user } = useAuth();
  
  // Fetch competencies from Firestore
  const { competencies } = useCompetencies();

  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState(defaultForm);
  const [originalCampaign, setOriginalCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationInput, setOrganizationInput] = useState('');

  // Video state
  const [availableVideos, setAvailableVideos] = useState<Video[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoSearch, setVideoSearch] = useState('');
  const [videoFilter, setVideoFilter] = useState<'all' | Video['source']>('all');
  const [selectedVideos, setSelectedVideos] = useState<Video[]>([]);

  // Organization state
  const [availableOrganizations, setAvailableOrganizations] = useState<Organization[]>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [organizationError, setOrganizationError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    const init = async () => {
      if (!user || !campaignId) return;

      try {
        setLoading(true);

        // 1. Fetch Campaign
        const campaign = await getCampaign(campaignId);
        if (!campaign) {
          setError('Campaign not found');
          return;
        }

        // Check ownership
        if (campaign.metadata.createdBy !== user.uid) {
          setError('You do not have permission to edit this campaign');
          return;
        }

        setOriginalCampaign(campaign);

        // 2. Fetch Videos for Campaign
        const campaignVideos: Video[] = [];
        for (const item of campaign.items) {
          const v = await getVideo(item.videoId);
          if (v) campaignVideos.push(v);
        }
        setSelectedVideos(campaignVideos);

        // 3. Populate Form
        setForm({
          name: campaign.title,
          description: campaign.description,
          targetCompetencies: campaign.metadata.tags || [campaign.skillFocus],
          selectedSkills: campaign.selectedSkills || {},
          allowedOrganizations: campaign.allowedOrganizations || [],
          anonymousResponses: campaign.anonymousResponses ?? true,
          startDate: campaign.schedule?.startDate || '',
          endDate: campaign.schedule?.endDate || '',
          frequency: campaign.schedule?.frequency || 'monthly',
          autoSendInvites: campaign.automation?.autoSendInvites ?? true,
          sendReminders: campaign.automation?.sendReminders ?? true,
          sendConfirmations: campaign.automation?.sendConfirmations ?? true,
        });

      } catch (err: any) {
        console.error('Failed to load campaign:', err);
        setError(err?.message || 'Failed to load campaign data');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [campaignId, user]);

  // Load available videos
  const loadVideos = useCallback(async () => {
    if (!user) return;
    setVideosLoading(true);
    try {
      const data = await getAllVideos();
      setAvailableVideos(data);
    } catch (err: any) {
      console.error('Failed to load videos:', err);
      setVideoError(err?.message);
    } finally {
      setVideosLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Load organizations
  useEffect(() => {
    const loadOrganizations = async () => {
      setOrganizationsLoading(true);
      try {
        const orgQuery = query(collection(db, 'organizations'), orderBy('name', 'asc'));
        const snapshot = await getDocs(orgQuery);
        const orgs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Organization, 'id'>),
        }));
        setAvailableOrganizations(orgs);
      } catch (err: any) {
        console.error('Failed to load organizations:', err);
        setOrganizationError(err?.message);
      } finally {
        setOrganizationsLoading(false);
      }
    };
    loadOrganizations();
  }, []);

  // --- Logic Helpers (same as new/page.tsx) ---

  const toggleCompetency = (comp: Competency) => {
    const isSelected = form.targetCompetencies.includes(comp.name);
    const updatedTargets = isSelected
      ? form.targetCompetencies.filter((name) => name !== comp.name)
      : [...form.targetCompetencies, comp.name];

    setForm((prev) => ({
      ...prev,
      targetCompetencies: updatedTargets,
      selectedSkills: isSelected
        ? Object.keys(prev.selectedSkills).reduce<Record<string, string[]>>((acc, key) => {
          if (key !== comp.id) acc[key] = prev.selectedSkills[key];
          return acc;
        }, {})
        : { ...prev.selectedSkills, [comp.id]: [] },
    }));

    if (updatedTargets.length >= 3 && updatedTargets.length <= 5) {
      const newErrors = new Set(fieldErrors);
      newErrors.delete('targetCompetencies');
      setFieldErrors(newErrors);
    }
  };

  const toggleSkill = (comp: Competency, skill: Skill) => {
    const currentSkills = form.selectedSkills[comp.id] || [];
    const isSelected = currentSkills.includes(skill.id);
    const updatedSkills = isSelected ? currentSkills.filter((id) => id !== skill.id) : [...currentSkills, skill.id];

    setForm((prev) => ({
      ...prev,
      selectedSkills: {
        ...prev.selectedSkills,
        [comp.id]: updatedSkills,
      },
    }));
  };

  const toggleOrganization = (organizationId: string) => {
    const isSelected = form.allowedOrganizations.includes(organizationId);
    const updated = isSelected
      ? form.allowedOrganizations.filter((org) => org !== organizationId)
      : [...form.allowedOrganizations, organizationId];
    setForm({ ...form, allowedOrganizations: updated });
  };

  const addCustomOrganization = () => {
    if (!organizationInput.trim()) return;
    const newOrgId = organizationInput.trim();
    if (!form.allowedOrganizations.includes(newOrgId)) {
      setForm({ ...form, allowedOrganizations: [...form.allowedOrganizations, newOrgId] });
    }
    setOrganizationInput('');
  };

  const filteredVideos = useMemo(() => {
    const query = videoSearch.trim().toLowerCase();
    return availableVideos.filter((video) => {
      const matchesQuery =
        !query ||
        video.title.toLowerCase().includes(query) ||
        video.description?.toLowerCase().includes(query);
      const matchesSource =
        videoFilter === 'all' ? true : video.source === videoFilter;
      return matchesQuery && matchesSource;
    });
  }, [availableVideos, videoFilter, videoSearch]);

  const selectedVideoIds = useMemo(
    () => new Set(selectedVideos.map((video) => video.id)),
    [selectedVideos],
  );

  const organizationNameMap = useMemo(() => {
    return availableOrganizations.reduce<Record<string, string>>((acc, org) => {
      acc[org.id] = org.name;
      return acc;
    }, {});
  }, [availableOrganizations]);

  const getOrganizationLabel = useCallback(
    (id: string) => organizationNameMap[id] || id,
    [organizationNameMap],
  );

  const handleVideoToggle = (video: Video) => {
    setSelectedVideos((prev) => {
      const updated = prev.some((item) => item.id === video.id)
        ? prev.filter((item) => item.id !== video.id)
        : [...prev, video];
      return updated;
    });
  };

  const handleMoveVideo = (videoId: string, direction: 'up' | 'down') => {
    setSelectedVideos((prev) => {
      const index = prev.findIndex((video) => video.id === videoId);
      if (index === -1) return prev;
      const nextIndex =
        direction === 'up'
          ? Math.max(0, index - 1)
          : Math.min(prev.length - 1, index + 1);
      if (index === nextIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  };

  const validateStep = (step: number): { message: string; errors: Set<string> } | null => {
    const errors = new Set<string>();

    if (step === 1) {
      if (!form.name.trim()) errors.add('name');
      if (!form.description.trim()) errors.add('description');
      if (form.targetCompetencies.length < 3 || form.targetCompetencies.length > 5) {
        errors.add('targetCompetencies');
      }
      const missingSkills = form.targetCompetencies.filter((compName) => {
        const comp = competencies.find((c) => c.name === compName);
        if (!comp) return true;
        return !form.selectedSkills[comp.id] || form.selectedSkills[comp.id].length === 0;
      });
      if (missingSkills.length > 0) {
        errors.add('selectedSkills');
        errors.add('targetCompetencies');
      }
      if (selectedVideos.length === 0) errors.add('videos');

      if (errors.size > 0) {
        if (!form.name.trim() || !form.description.trim()) {
          return { message: 'Add a campaign name and description to continue.', errors };
        }
        if (form.targetCompetencies.length < 3 || form.targetCompetencies.length > 5) {
          return { message: 'Select between 3 and 5 competencies.', errors };
        }
        if (missingSkills.length > 0) {
          return { message: `Select at least one skill for: ${missingSkills.join(', ')}`, errors };
        }
        if (selectedVideos.length === 0) {
          return { message: 'Add at least one video from your library.', errors };
        }
      }
    }

    if (step === 3) {
      if (!form.startDate) errors.add('startDate');
      if (!form.endDate) errors.add('endDate');
      if (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
        errors.add('startDate');
        errors.add('endDate');
      }

      if (errors.size > 0) {
        if (!form.startDate || !form.endDate) {
          return { message: 'Choose a start and end date.', errors };
        }
        if (new Date(form.startDate) > new Date(form.endDate)) {
          return { message: 'End date must be after the start date.', errors };
        }
      }
    }

    return null;
  };

  const handleNextStep = () => {
    const result = validateStep(wizardStep);
    if (result) {
      setValidationMessage(result.message);
      setFieldErrors(result.errors);
      return;
    }
    setValidationMessage(null);
    setFieldErrors(new Set());
    setWizardStep((prev) => Math.min(prev + 1, wizardSteps.length));
  };

  const handlePrevStep = () => {
    setValidationMessage(null);
    setFieldErrors(new Set());
    setWizardStep((prev) => Math.max(prev - 1, 1));
  };

  const handleUpdateCampaign = async (publish: boolean) => {
    const result = validateStep(3);
    if (result) {
      setValidationMessage(result.message);
      setFieldErrors(result.errors);
      setWizardStep(3);
      return;
    }

    if (!user || !originalCampaign || !campaignId) return;

    setSaving(true);
    setError(null);

    try {
      // 1. Update Campaign details
      const cleanAllowedOrganizations = form.allowedOrganizations.filter(
        (orgId): orgId is string => typeof orgId === 'string' && orgId.trim().length > 0,
      );

      await updateCampaign(campaignId, {
        title: form.name,
        description: form.description,
        skillFocus: form.targetCompetencies[0] || originalCampaign.skillFocus,
        tags: form.targetCompetencies,
        allowedOrganizations: cleanAllowedOrganizations,
        selectedSkills: form.selectedSkills,
        anonymousResponses: form.anonymousResponses,
        schedule: {
          startDate: form.startDate,
          endDate: form.endDate,
          frequency: form.frequency,
        },
        automation: {
          autoSendInvites: form.autoSendInvites,
          sendReminders: form.sendReminders,
          sendConfirmations: form.sendConfirmations,
        },
      });

      // Also update tags which are stored in metadata in the campaign object but handled differently in updates sometimes
      // The updateCampaign function takes Partial<Omit<CampaignDoc, 'id' | 'metadata'>>
      // But tags are inside metadata in Campaign interface, let's check updateCampaign implementation


      // 2. Update Publish State
      if (publish !== originalCampaign.metadata.isPublished) {
        await setCampaignPublishState(campaignId, publish);
      }

      // 3. Update Video Items
      // Delete existing items
      if (originalCampaign.items.length > 0) {
        await batchDeleteCampaignItems(
          campaignId,
          originalCampaign.items.map(i => i.id)
        );
      }

      // Create new items in current order
      if (selectedVideos.length > 0) {
        await Promise.all(
          selectedVideos.map((video, index) =>
            createCampaignItem(
              campaignId,
              video.id,
              index,
              video.questions && video.questions.length > 0 ? video.questions : undefined,
            ),
          ),
        );
      }

      router.push(`/campaign?id=${campaignId}`);
    } catch (err: any) {
      console.error('Failed to update campaign:', err);
      setError(err?.message || 'Unable to update campaign right now.');
    } finally {
      setSaving(false);
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
  }

  if (error && !originalCampaign) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => router.push('/campaigns')}
            className="px-4 py-2 text-sm font-semibold text-slate-600 border rounded-xl hover:bg-slate-50"
          >
            Back to campaigns
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8 text-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Campaign Management</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Edit Campaign</h1>
            <p className="mt-2 text-slate-500 max-w-2xl">
              Update your campaign strategy, audience, or schedule.
            </p>
          </div>
          <button
            onClick={() => router.push(`/campaign?id=${campaignId}`)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel
          </button>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6">
            {wizardSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${wizardStep >= step.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                    }`}
                >
                  {wizardStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${wizardStep >= step.id ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p>
                  <p className="text-xs text-slate-400">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {validationMessage && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {validationMessage}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* STEP 1: Setup */}
          {wizardStep === 1 && (
            <div className="mt-8 space-y-8">
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">Campaign name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      if (fieldErrors.has('name')) {
                        const newErrors = new Set(fieldErrors);
                        newErrors.delete('name');
                        setFieldErrors(newErrors);
                      }
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 shadow-sm focus:ring-0 ${fieldErrors.has('name')
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-slate-200 focus:border-sky-400'
                      }`}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">Program summary</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => {
                      setForm({ ...form, description: e.target.value });
                      if (fieldErrors.has('description')) {
                        const newErrors = new Set(fieldErrors);
                        newErrors.delete('description');
                        setFieldErrors(newErrors);
                      }
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 shadow-sm focus:ring-0 ${fieldErrors.has('description')
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-slate-200 focus:border-sky-400'
                      }`}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Target competencies (pick 3-5)</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {competencies.map((comp) => {
                    const isSelected = form.targetCompetencies.includes(comp.name);
                    const hasError = fieldErrors.has('targetCompetencies') || fieldErrors.has('selectedSkills');
                    const missingSkills = isSelected && (!form.selectedSkills[comp.id] || form.selectedSkills[comp.id].length === 0);
                    return (
                      <button
                        key={comp.id}
                        onClick={() => toggleCompetency(comp)}
                        type="button"
                        className={`rounded-2xl border px-4 py-3 text-left transition ${hasError && (missingSkills || !isSelected)
                          ? 'border-red-400 bg-red-50 text-red-700'
                          : isSelected
                            ? 'border-sky-400 bg-sky-50 text-sky-700 shadow-sm'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                      >
                        <p className="text-sm font-semibold">{comp.name}</p>
                        <p className="text-xs text-slate-500">{comp.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.targetCompetencies.length > 0 && (
                <div className="space-y-6 rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
                  <p className="text-sm font-semibold text-slate-700">Skills & behaviors</p>
                  {competencies
                    .filter((comp) => form.targetCompetencies.includes(comp.name))
                    .map((comp) => (
                      <div key={comp.id} className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
                        <p className="text-sm font-semibold text-slate-800">{comp.name}</p>
                        <div className="mt-3 space-y-2">
                          {comp.skills.map((skill) => {
                            const isSelected = form.selectedSkills[comp.id]?.includes(skill.id);
                            return (
                              <label
                                key={skill.id}
                                className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${isSelected ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSkill(comp, skill)}
                                  className="mt-1 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                                />
                                <div>
                                  <p className="font-medium text-slate-800">{skill.name}</p>
                                  <p className="text-xs text-slate-500">{skill.description}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Video Selection */}
              <div className={`space-y-6 rounded-3xl border bg-white p-6 ${fieldErrors.has('videos') ? 'border-red-400 bg-red-50/30' : 'border-slate-200'
                }`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Attach video modules</p>
                    <p className="text-xs text-slate-500">
                      Choose from your saved library. Selection order sets the learner sequence.
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={videoSearch}
                        onChange={(e) => setVideoSearch(e.target.value)}
                        placeholder="Search videos..."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
                      />
                    </div>
                    <select
                      value={videoFilter}
                      onChange={(e) => setVideoFilter(e.target.value as 'all' | Video['source'])}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none"
                    >
                      <option value="all">All sources</option>
                      <option value="generated">AI generated</option>
                      <option value="uploaded">Uploaded</option>
                    </select>
                  </div>
                </div>

                {videoError && (
                  <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <span>{videoError}</span>
                    <button type="button" onClick={loadVideos} className="text-xs font-semibold text-rose-900 underline">
                      Retry
                    </button>
                  </div>
                )}

                {selectedVideos.length > 0 && (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">
                        Selected videos ({selectedVideos.length})
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedVideos([])}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="space-y-3">
                      {selectedVideos.map((video, index) => (
                        <div
                          key={video.id}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                              {video.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatVideoDuration(video.duration)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveVideo(video.id, 'up')}
                              className="rounded-full border border-slate-200 p-1 text-slate-500 hover:text-slate-900 disabled:opacity-40"
                            >
                              <MoveUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={index === selectedVideos.length - 1}
                              onClick={() => handleMoveVideo(video.id, 'down')}
                              className="rounded-full border border-slate-200 p-1 text-slate-500 hover:text-slate-900 disabled:opacity-40"
                            >
                              <MoveDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVideoToggle(video)}
                              className="rounded-full border border-slate-200 p-1 text-slate-500 hover:text-rose-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {videosLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : filteredVideos.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
                    <p className="text-sm text-slate-500">
                      {availableVideos.length === 0
                        ? 'No saved videos yet. Save videos from the library to link them here.'
                        : 'No videos match your search or filter.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {filteredVideos.map((video) => {
                      const isSelected = selectedVideoIds.has(video.id);
                      return (
                        <button
                          key={video.id}
                          type="button"
                          onClick={() => handleVideoToggle(video)}
                          className={`flex gap-4 rounded-2xl border px-4 py-4 text-left transition ${isSelected
                            ? 'border-slate-900 bg-slate-900/5 shadow-md'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                        >
                          <div className="h-20 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {video.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={video.thumbnailUrl}
                                alt={video.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-400">
                                <Play className="h-6 w-6" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="line-clamp-1 text-base font-semibold text-slate-900">
                              {video.title}
                            </p>
                            {video.description && (
                              <p className="text-sm text-slate-500 line-clamp-2">{video.description}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Organizations */}
          {wizardStep === 2 && (
            <div className="mt-8 space-y-8">
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="mb-5">
                  <p className="text-sm font-semibold text-slate-800">Organization Access</p>
                  <p className="text-xs text-slate-500">Select which organizations can participate in this campaign.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {organizationsLoading ? (
                    <div className="col-span-full text-sm text-slate-500">Loading organizations…</div>
                  ) : availableOrganizations.length === 0 ? (
                    <div className="col-span-full text-sm text-slate-500">No organizations found.</div>
                  ) : (
                    availableOrganizations.map((org) => {
                      const isSelected = form.allowedOrganizations.includes(org.id);
                      return (
                        <label
                          key={org.id}
                          className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-sky-50 border-sky-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOrganization(org.id)}
                            className="w-4 h-4 rounded border-gray-300 text-sky-500 focus:ring-2 focus:ring-sky-500"
                          />
                          <span className="text-sm text-gray-900 font-medium">{org.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>

                {/* Custom Orgs */}
                {form.allowedOrganizations.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {form.allowedOrganizations.map((orgId) => (
                      <div
                        key={orgId}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-sm text-slate-700 font-medium"
                      >
                        <span>{getOrganizationLabel(orgId)}</span>
                        <button
                          onClick={() => toggleOrganization(orgId)}
                          className="hover:text-slate-900 transition-colors"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    placeholder="Add custom organization..."
                    value={organizationInput}
                    onChange={(e) => setOrganizationInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') addCustomOrganization();
                    }}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    onClick={addCustomOrganization}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Anonymous responses</p>
                    <p className="text-xs text-slate-500">Hide identity data in reporting.</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={form.anonymousResponses}
                      onChange={(e) => setForm({ ...form, anonymousResponses: e.target.checked })}
                      className="sr-only"
                    />
                    <span className={`relative h-6 w-11 rounded-full border transition ${form.anonymousResponses ? 'border-sky-400 bg-sky-500' : 'border-slate-200 bg-slate-200'}`}>
                      <span className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition ${form.anonymousResponses ? 'left-[20px]' : 'left-[2px]'}`} />
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Schedule */}
          {wizardStep === 3 && (
            <div className="mt-8 space-y-8">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">Start date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => {
                      setForm({ ...form, startDate: e.target.value });
                      if (fieldErrors.has('startDate')) {
                        const newErrors = new Set(fieldErrors);
                        newErrors.delete('startDate');
                        setFieldErrors(newErrors);
                      }
                    }}
                    className={`ml-4 rounded-2xl border px-4 py-3 text-sm text-slate-900 shadow-sm focus:ring-0 ${fieldErrors.has('startDate') ? 'border-red-400' : 'border-slate-200'}`}
                    required
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">End date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => {
                      setForm({ ...form, endDate: e.target.value });
                      if (fieldErrors.has('endDate')) {
                        const newErrors = new Set(fieldErrors);
                        newErrors.delete('endDate');
                        setFieldErrors(newErrors);
                      }
                    }}
                    className={`ml-4 rounded-2xl border px-4 py-3 text-sm text-slate-900 shadow-sm focus:ring-0 ${fieldErrors.has('endDate') ? 'border-red-400' : 'border-slate-200'}`}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">Cadence</label>
                  <select
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value as any })}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
                  >
                    {frequencyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Automation toggles */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">Auto-send invites</label>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600"><Mail className="h-4 w-4 text-sky-500" /> Email</div>
                    <label className="inline-flex cursor-pointer items-center">
                      <input type="checkbox" checked={form.autoSendInvites} onChange={(e) => setForm({ ...form, autoSendInvites: e.target.checked })} className="sr-only" />
                      <span className={`relative h-6 w-11 rounded-full border transition ${form.autoSendInvites ? 'border-sky-400 bg-sky-500' : 'border-slate-200 bg-slate-200'}`}>
                        <span className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition ${form.autoSendInvites ? 'left-[20px]' : 'left-[2px]'}`} />
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">Reminders</label>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600"><Bell className="h-4 w-4 text-sky-500" /> Nudges</div>
                    <label className="inline-flex cursor-pointer items-center">
                      <input type="checkbox" checked={form.sendReminders} onChange={(e) => setForm({ ...form, sendReminders: e.target.checked })} className="sr-only" />
                      <span className={`relative h-6 w-11 rounded-full border transition ${form.sendReminders ? 'border-sky-400 bg-sky-500' : 'border-slate-200 bg-slate-200'}`}>
                        <span className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition ${form.sendReminders ? 'left-[20px]' : 'left-[2px]'}`} />
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <Calendar className="h-10 w-10 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">Automations & confirmations</p>
                    <p className="text-xs text-slate-500">Send confirmation emails upon completion.</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center">
                    <input type="checkbox" checked={form.sendConfirmations} onChange={(e) => setForm({ ...form, sendConfirmations: e.target.checked })} className="sr-only" />
                    <span className={`relative h-6 w-11 rounded-full border transition ${form.sendConfirmations ? 'border-sky-400 bg-sky-500' : 'border-slate-200 bg-slate-200'}`}>
                      <span className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition ${form.sendConfirmations ? 'left-[20px]' : 'left-[2px]'}`} />
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
            <div className="text-sm text-slate-500">Step {wizardStep} of {wizardSteps.length}</div>
            <div className="flex flex-wrap gap-3">
              {wizardStep > 1 && (
                <button onClick={handlePrevStep} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              )}
              {wizardStep < 3 && (
                <button onClick={handleNextStep} className="btn-primary inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-semibold text-white">
                  Next step <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {wizardStep === 3 && (
                <>
                  <button
                    onClick={() => handleUpdateCampaign(false)}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving…' : 'Update as Draft'}
                  </button>
                  <button
                    onClick={() => handleUpdateCampaign(true)}
                    disabled={saving}
                    className="btn-primary inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Play className="h-4 w-4" />
                    {saving ? 'Updating…' : 'Update & Publish'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

