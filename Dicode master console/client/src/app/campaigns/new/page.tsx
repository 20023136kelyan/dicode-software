'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import MainLayout from '@/components/Layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { createCampaign, setCampaignPublishState, getAllVideos, createCampaignItem } from '@/lib/firestore';
import { COMPETENCIES, type CompetencyDefinition, type SkillDefinition } from '@/lib/competencies';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Info,
  Mail,
  Play,
  Save,
  Search,
  Sparkles,
  Users,
  Loader2,
  MoveUp,
  MoveDown,
  X,
} from 'lucide-react';
import type { Organization, Video } from '@/lib/types';

type Skill = SkillDefinition;
type Competency = CompetencyDefinition;

type Employee = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  region: string;
};

const competencies: Competency[] = COMPETENCIES;

const availableEmployees: Employee[] = [
  { id: 'emp-1', name: 'Sarah Johnson', email: 'sarah.johnson@dicode.com', department: 'Marketing', role: 'Manager', region: 'North America' },
  { id: 'emp-2', name: 'Mike Chen', email: 'mike.chen@dicode.com', department: 'Product', role: 'Director', region: 'Asia Pacific' },
  { id: 'emp-3', name: 'Emily Davis', email: 'emily.davis@dicode.com', department: 'Operations', role: 'Senior Manager', region: 'Europe' },
  { id: 'emp-4', name: 'David Wilson', email: 'david.wilson@dicode.com', department: 'Sales', role: 'VP', region: 'North America' },
  { id: 'emp-5', name: 'Lisa Anderson', email: 'lisa.anderson@dicode.com', department: 'People', role: 'Director', region: 'North America' },
  { id: 'emp-6', name: 'Noah Patel', email: 'noah.patel@dicode.com', department: 'Finance', role: 'Manager', region: 'Asia Pacific' },
];

const campaignTemplates = [
  {
    id: 'leadership-checkin',
    name: 'Leadership Check-In',
    duration: '4 weeks',
    description: 'Pulse on leadership behaviors to reinforce trust and alignment.',
    competencies: ['Psychological Safety', 'Collaboration & Allyship'],
    accent: 'bg-sky-50 text-sky-700 border-sky-100',
  },
  {
    id: 'culture-pulse',
    name: 'Culture & Equity Pulse',
    duration: '3 weeks',
    description: 'Track inclusion, bias, and belonging across teams.',
    competencies: ['Equity & Inclusion', 'Collaboration & Allyship'],
    accent: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  {
    id: 'future-skills',
    name: 'Future Skills Sprint',
    duration: '5 weeks',
    description: 'Upskill leaders on adaptability, innovation, and resilience.',
    competencies: ['Growth & Adaptability'],
    accent: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  },
];

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

export default function NewCampaignPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState(defaultForm);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [organizationInput, setOrganizationInput] = useState('');
  const [availableVideos, setAvailableVideos] = useState<Video[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [availableOrganizations, setAvailableOrganizations] = useState<Organization[]>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const loadVideos = useCallback(async () => {
    if (!user) {
      setAvailableVideos([]);
      return;
    }
    setVideosLoading(true);
    setVideoError(null);
    try {
      const data = await getAllVideos();
      setAvailableVideos(data);
    } catch (err: any) {
      console.error('Failed to load videos:', err);
      setVideoError(err?.message || 'Unable to load videos right now.');
    } finally {
      setVideosLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    const loadOrganizations = async () => {
      setOrganizationsLoading(true);
      setOrganizationError(null);
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
        setOrganizationError(err?.message || 'Unable to load organizations right now.');
      } finally {
        setOrganizationsLoading(false);
      }
    };

    loadOrganizations();
  }, []);

  const [videoSearch, setVideoSearch] = useState('');
  const [videoFilter, setVideoFilter] = useState<'all' | Video['source']>('all');
  const [selectedVideos, setSelectedVideos] = useState<Video[]>([]);

  // Available organizations (matches access management)
  const handleTemplateSelect = (templateId: string) => {
    const template = campaignTemplates.find((tpl) => tpl.id === templateId);
    if (!template) return;

    const templateCompetencies = template.competencies.slice(0, 3);
    setActiveTemplate(templateId);
    setForm({
      ...form,
      name: template.name,
      description: template.description,
      targetCompetencies: templateCompetencies,
      selectedSkills: templateCompetencies.reduce<Record<string, string[]>>((acc, compName) => {
        const comp = competencies.find((c) => c.name === compName);
        if (comp) acc[comp.id] = comp.skills.slice(0, 2).map((skill) => skill.id);
        return acc;
      }, {}),
    });
    setWizardStep(1);
  };

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
    setValidationMessage(null);
    // Clear errors if competencies are now valid (3-5 selected)
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
    setValidationMessage(null);
    // Clear errors if all competencies now have skills
    const allHaveSkills = form.targetCompetencies.every((compName) => {
      const c = competencies.find((co) => co.name === compName);
      if (!c) return false;
      const skills = c.id === comp.id ? updatedSkills : (form.selectedSkills[c.id] || []);
      return skills.length > 0;
    });
    if (allHaveSkills) {
      const newErrors = new Set(fieldErrors);
      newErrors.delete('selectedSkills');
      newErrors.delete('targetCompetencies');
      setFieldErrors(newErrors);
    }
  };

  const toggleOrganization = (organizationId: string) => {
    const isSelected = form.allowedOrganizations.includes(organizationId);
    const updated = isSelected
      ? form.allowedOrganizations.filter((org) => org !== organizationId)
      : [...form.allowedOrganizations, organizationId];
    setForm({
      ...form,
      allowedOrganizations: updated,
    });
    // Clear errors if at least one organization is selected
    if (updated.length > 0 && fieldErrors.has('allowedOrganizations')) {
      const newErrors = new Set(fieldErrors);
      newErrors.delete('allowedOrganizations');
      setFieldErrors(newErrors);
    }
  };

  const addCustomOrganization = () => {
    if (!organizationInput.trim()) return;
    const newOrgId = organizationInput.trim();
    if (!form.allowedOrganizations.includes(newOrgId)) {
      const updated = [...form.allowedOrganizations, newOrgId];
      setForm({
        ...form,
        allowedOrganizations: updated,
      });
      // Clear errors if at least one organization is selected
      if (updated.length > 0 && fieldErrors.has('allowedOrganizations')) {
        const newErrors = new Set(fieldErrors);
        newErrors.delete('allowedOrganizations');
        setFieldErrors(newErrors);
      }
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
      // Clear errors if at least one video is selected
      if (updated.length > 0 && fieldErrors.has('videos')) {
        const newErrors = new Set(fieldErrors);
        newErrors.delete('videos');
        setFieldErrors(newErrors);
      }
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
      if (!form.name.trim()) {
        errors.add('name');
      }
      if (!form.description.trim()) {
        errors.add('description');
      }
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
      if (selectedVideos.length === 0) {
        errors.add('videos');
      }

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

    // Step 2 validation - organizations optional (open campaign)
    if (step === 2) {
      // No validation required; leave open campaigns allowed
    }

    if (step === 3) {
      if (!form.startDate) {
        errors.add('startDate');
      }
      if (!form.endDate) {
        errors.add('endDate');
      }
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

  const persistCampaign = async (publish: boolean) => {
    const result = validateStep(3);
    if (result) {
      setValidationMessage(result.message);
      setFieldErrors(result.errors);
      setWizardStep(3);
      return;
    }

    if (!user) {
      setError('Please sign in to create a campaign.');
      return;
    }
    if (selectedVideos.length === 0) {
      setError('Select at least one video to include in your campaign.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const cleanAllowedOrganizations = form.allowedOrganizations.filter(
        (orgId): orgId is string => typeof orgId === 'string' && orgId.trim().length > 0,
      );
      const campaignPayload = {
        title: form.name,
        description: form.description,
        skillFocus: form.targetCompetencies[0] || 'Leadership',
        tags: form.targetCompetencies,
        ...(cleanAllowedOrganizations.length > 0 ? { allowedOrganizations: cleanAllowedOrganizations } : {}),
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
      };

      if (process.env.NODE_ENV !== 'production') {
        console.log('[Campaign Wizard] createCampaign payload', campaignPayload);
      }

      const newCampaignId = await createCampaign(user.uid, campaignPayload);

      if (publish) {
        await setCampaignPublishState(newCampaignId, true);
      }
      if (selectedVideos.length > 0) {
        await Promise.all(
          selectedVideos.map((video, index) =>
            createCampaignItem(
              newCampaignId,
              video.id,
              index,
              video.questions && video.questions.length > 0 ? video.questions : undefined,
            ),
          ),
        );
      }
      router.push(`/campaign?id=${newCampaignId}`);
    } catch (err: any) {
      setError(err?.message || 'Unable to save campaign right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8 text-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Campaign creation</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Launch a new DiCode campaign</h1>
            <p className="mt-2 text-slate-500 max-w-2xl">
              Match the DiCode 2 launch flow—move from strategy and competencies to audiences and automation in a single guided experience.
            </p>
          </div>
          <button
            onClick={() => router.push('/campaigns')}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to campaigns
          </button>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {campaignTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template.id)}
              className={`flex flex-col rounded-3xl border px-5 py-4 text-left transition-all ${activeTemplate === template.id ? 'border-sky-400 shadow-lg' : 'border-slate-200 hover:border-sky-200'
                }`}
            >
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${template.accent}`}>
                <Sparkles className="h-3.5 w-3.5" />
                Template
              </div>
              <h3 className="mt-3 text-lg font-semibold">{template.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{template.description}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                {template.competencies.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-slate-400">{template.duration}</p>
            </button>
          ))}
        </section>

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
                    placeholder="e.g., Q2 Leadership Pulse"
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
                    placeholder="Why are we running this campaign?"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Target competencies (pick 3-5)</p>
                    <p className="text-xs text-slate-500">Match the DiCode 2 approach by pairing each competency with skills.</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
                    <Info className="h-3.5 w-3.5" />
                    Required for wizard progression
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
                    <button
                      type="button"
                      onClick={loadVideos}
                      className="text-xs font-semibold text-rose-900 underline"
                    >
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
                              {formatVideoDuration(video.duration)} •{' '}
                              {video.metadata.createdAt
                                ? new Date(video.metadata.createdAt).toLocaleDateString()
                                : '—'}
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
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                              <span className="rounded-full border border-slate-200 px-2 py-0.5">
                                {video.source === 'generated' ? 'AI Generated' : 'Uploaded'}
                              </span>
                              {video.duration !== undefined && (
                                <span>{formatVideoDuration(video.duration)}</span>
                              )}
                              {video.metadata.createdAt && (
                                <span>{new Date(video.metadata.createdAt).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="mt-8 space-y-8">
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="mb-5">
                  <p className="text-sm font-semibold text-slate-800">Organization Access</p>
                  <p className="text-xs text-slate-500">Select which organizations can participate in this campaign.</p>
                </div>

                {/* Organization Checkboxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {organizationsLoading ? (
                    <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      Loading organizations…
                    </div>
                  ) : organizationError ? (
                    <div className="col-span-full rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {organizationError}
                    </div>
                  ) : availableOrganizations.length === 0 ? (
                    <div className="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      No organizations found yet. Add a custom organization below to proceed.
                    </div>
                  ) : (
                    availableOrganizations.map((org) => {
                      const isSelected = form.allowedOrganizations.includes(org.id);
                      return (
                        <label
                          key={org.id}
                          className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected
                              ? 'bg-sky-50 border-sky-300'
                              : 'bg-gray-50 border-gray-200 hover:border-gray-300'
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

                {/* Custom Organizations */}
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

                {/* Add Custom Organization */}
                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    placeholder="Add custom organization..."
                    value={organizationInput}
                    onChange={(e) => setOrganizationInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addCustomOrganization();
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                  <button
                    onClick={addCustomOrganization}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>

                {/* Anonymous responses toggle */}
                <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Anonymous responses</p>
                    <p className="text-xs text-slate-500">Hide identity data in reporting, mirroring DiCode 2 defaults.</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={form.anonymousResponses}
                      onChange={(e) => setForm({ ...form, anonymousResponses: e.target.checked })}
                      className="sr-only"
                    />
                    <span
                      className={`relative h-6 w-11 rounded-full border transition ${form.anonymousResponses ? 'border-sky-400 bg-sky-500' : 'border-slate-200 bg-slate-200'
                        }`}
                    >
                      <span
                        className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition ${form.anonymousResponses ? 'left-[20px]' : 'left-[2px]'
                          }`}
                      />
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="mt-8 space-y-8">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">
                    Start date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => {
                      setForm({ ...form, startDate: e.target.value });
                      if (fieldErrors.has('startDate')) {
                        const newErrors = new Set(fieldErrors);
                        newErrors.delete('startDate');
                        // Also clear endDate error if dates are now valid
                        if (form.endDate && new Date(e.target.value) <= new Date(form.endDate)) {
                          newErrors.delete('endDate');
                        }
                        setFieldErrors(newErrors);
                      }
                    }}
                    className={`ml-4 rounded-2xl border px-4 py-3 text-sm text-slate-900 shadow-sm focus:ring-0 ${fieldErrors.has('startDate')
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-200 focus:border-sky-400'
                      }`}
                    required
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">
                    End date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => {
                      setForm({ ...form, endDate: e.target.value });
                      if (fieldErrors.has('endDate')) {
                        const newErrors = new Set(fieldErrors);
                        newErrors.delete('endDate');
                        // Also clear startDate error if dates are now valid
                        if (form.startDate && new Date(form.startDate) <= new Date(e.target.value)) {
                          newErrors.delete('startDate');
                        }
                        setFieldErrors(newErrors);
                      }
                    }}
                    className={`ml-4 rounded-2xl border px-4 py-3 text-sm text-slate-900 shadow-sm focus:ring-0 ${fieldErrors.has('endDate')
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-200 focus:border-sky-400'
                      }`}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">Cadence</label>
                  <select
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value as (typeof frequencyOptions)[number] })}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:ring-0"
                  >
                    {frequencyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">Auto-send invites</label>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail className="h-4 w-4 text-sky-500" />
                      Email reminders
                    </div>
                    <label className="inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={form.autoSendInvites}
                        onChange={(e) => setForm({ ...form, autoSendInvites: e.target.checked })}
                        className="sr-only"
                      />
                      <span
                        className={`relative h-6 w-11 rounded-full border transition ${form.autoSendInvites ? 'border-sky-400 bg-sky-500' : 'border-slate-200 bg-slate-200'
                          }`}
                      >
                        <span
                          className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition ${form.autoSendInvites ? 'left-[20px]' : 'left-[2px]'
                            }`}
                        />
                      </span>
                    </label>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">Reminders</label>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Bell className="h-4 w-4 text-sky-500" />
                      Nudges
                    </div>
                    <label className="inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={form.sendReminders}
                        onChange={(e) => setForm({ ...form, sendReminders: e.target.checked })}
                        className="sr-only"
                      />
                      <span
                        className={`relative h-6 w-11 rounded-full border transition ${form.sendReminders ? 'border-sky-400 bg-sky-500' : 'border-slate-200 bg-slate-200'
                          }`}
                      >
                        <span
                          className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition ${form.sendReminders ? 'left-[20px]' : 'left-[2px]'
                            }`}
                        />
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
                    <p className="text-xs text-slate-500">
                      DiCode 2 sends confirmation emails upon completion. Keep that behavior aligned here.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={form.sendConfirmations}
                      onChange={(e) => setForm({ ...form, sendConfirmations: e.target.checked })}
                      className="sr-only"
                    />
                    <span
                      className={`relative h-6 w-11 rounded-full border transition ${form.sendConfirmations ? 'border-sky-400 bg-sky-500' : 'border-slate-200 bg-slate-200'
                        }`}
                    >
                      <span
                        className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition ${form.sendConfirmations ? 'left-[20px]' : 'left-[2px]'
                          }`}
                      />
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
            <div className="text-sm text-slate-500">
              Step {wizardStep} of {wizardSteps.length}
            </div>

            <div className="flex flex-wrap gap-3">
              {wizardStep > 1 && (
                <button
                  onClick={handlePrevStep}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}

              {wizardStep < 3 && (
                <button
                  onClick={handleNextStep}
                  className="btn-primary inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-semibold text-white"
                >
                  Next step
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              {wizardStep === 3 && (
                <>
                  <button
                    onClick={() => persistCampaign(false)}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {loading ? 'Saving…' : 'Save as draft'}
                  </button>
                  <button
                    onClick={() => persistCampaign(true)}
                    disabled={loading}
                    className="btn-primary inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Play className="h-4 w-4" />
                    {loading ? 'Launching…' : 'Launch campaign'}
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
