'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import MainLayout from '@/components/Layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { createCampaign, setCampaignPublishState, getAllVideos, createCampaignItem, logActivity } from '@/lib/firestore';
import { type CompetencyDefinition, type SkillDefinition } from '@/lib/competencies';
import { useCompetencies } from '@/hooks/useCompetencies';
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
  RefreshCw,
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
    competencies: ['Foster Psychological Safety', 'Encourage Collaboration', 'Establish Prosocial Norms'],
    accent: 'bg-sky-50 text-sky-700 border-sky-100',
  },
  {
    id: 'culture-pulse',
    name: 'Culture & Equity Pulse',
    duration: '3 weeks',
    description: 'Track inclusion, bias, and belonging across teams.',
    competencies: ['Establish Prosocial Norms', 'Encourage Collaboration', 'Foster Psychological Safety'],
    accent: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  {
    id: 'future-skills',
    name: 'Future Skills Sprint',
    duration: '5 weeks',
    description: 'Upskill leaders on adaptability, innovation, and resilience.',
    competencies: ['Prioritize Growth', 'Encourage Collaboration', 'Foster Psychological Safety'],
    accent: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  },
];

const wizardSteps = [
  { id: 1, label: 'Setup', description: 'Goals, competencies, and skills' },
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

// Competency Card Grid Component
interface CompetencyCardGridProps {
  competencies: Competency[];
  selectedCompetencies: string[];
  selectedSkills: Record<string, string[]>;
  onUpdate: (targetCompetencies: string[], selectedSkills: Record<string, string[]>) => void;
}

const CompetencyCardGrid: React.FC<CompetencyCardGridProps> = ({
  competencies,
  selectedCompetencies,
  selectedSkills,
  onUpdate,
}) => {
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const [popoverStep, setPopoverStep] = useState<'competencies' | 'skills'>('competencies');
  const [tempSelectedCompetency, setTempSelectedCompetency] = useState<Competency | null>(null);
  const [tempSelectedSkills, setTempSelectedSkills] = useState<string[]>([]);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const filledCount = selectedCompetencies.length;
  const emptySlots = Math.max(0, 3 - filledCount);
  const totalCards = filledCount + emptySlots;

  const availableCompetencies = competencies.filter(
    comp => !selectedCompetencies.includes(comp.name)
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        handleClosePopover();
      }
    };
    if (activeCardIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeCardIndex]);

  const handleOpenCard = (index: number, existingCompetency?: string) => {
    setActiveCardIndex(index);
    if (existingCompetency) {
      const comp = competencies.find(c => c.name === existingCompetency);
      if (comp) {
        setTempSelectedCompetency(comp);
        setTempSelectedSkills(selectedSkills[comp.id] || []);
        setPopoverStep('skills');
      }
    } else {
      setTempSelectedCompetency(null);
      setTempSelectedSkills([]);
      setPopoverStep('competencies');
    }
  };

  const handleSelectCompetency = (comp: Competency) => {
    setTempSelectedCompetency(comp);
    setTempSelectedSkills([]);
    setPopoverStep('skills');
  };

  const handleToggleSkill = (skillId: string) => {
    setTempSelectedSkills(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
  };

  const handleDone = () => {
    if (!tempSelectedCompetency) return;

    const newSelectedCompetencies = [...selectedCompetencies];
    const newSelectedSkills = { ...selectedSkills };

    const cardIndex = activeCardIndex!;
    const existingCompName = cardIndex < filledCount ? selectedCompetencies[cardIndex] : null;

    if (existingCompName) {
      const existingComp = competencies.find(c => c.name === existingCompName);
      if (existingComp) {
        delete newSelectedSkills[existingComp.id];
      }
      newSelectedCompetencies[cardIndex] = tempSelectedCompetency.name;
    } else {
      newSelectedCompetencies.push(tempSelectedCompetency.name);
    }

    newSelectedSkills[tempSelectedCompetency.id] = tempSelectedSkills;
    onUpdate(newSelectedCompetencies, newSelectedSkills);
    handleClosePopover();
  };

  const handleClosePopover = () => {
    setActiveCardIndex(null);
    setPopoverStep('competencies');
    setTempSelectedCompetency(null);
    setTempSelectedSkills([]);
  };

  const handleRemoveCard = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const compName = selectedCompetencies[index];
    const comp = competencies.find(c => c.name === compName);
    
    const newSelectedCompetencies = selectedCompetencies.filter((_, i) => i !== index);
    const newSelectedSkills = { ...selectedSkills };
    if (comp) {
      delete newSelectedSkills[comp.id];
    }
    
    onUpdate(newSelectedCompetencies, newSelectedSkills);
  };

  const handleBackToCompetencies = () => {
    setPopoverStep('competencies');
    setTempSelectedCompetency(null);
    setTempSelectedSkills([]);
  };

  const renderDropdownContent = () => {
    if (popoverStep === 'competencies') {
      return (
        <>
          <div className="p-3 border-b border-slate-200">
            <p className="text-sm font-semibold text-slate-900">Select Competency</p>
          </div>
          <div className="max-h-[200px] overflow-y-auto p-2">
            {availableCompetencies.length > 0 ? (
              availableCompetencies.map(comp => (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => handleSelectCompetency(comp)}
                  className="w-full flex items-start gap-3 rounded-lg p-2.5 text-left hover:bg-slate-50 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{comp.name}</p>
                    <p className="text-xs text-slate-500 line-clamp-1">{comp.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">All competencies selected</p>
            )}
          </div>
        </>
      );
    }

    if (popoverStep === 'skills' && tempSelectedCompetency) {
      return (
        <>
          <div className="flex items-center gap-2 p-3 border-b border-slate-200">
            <button
              type="button"
              onClick={handleBackToCompetencies}
              className="p-1 rounded-md hover:bg-slate-100 transition"
            >
              <ArrowLeft className="h-4 w-4 text-slate-500" />
            </button>
            <p className="text-sm font-semibold text-slate-900 truncate">{tempSelectedCompetency.name}</p>
          </div>
          <div className="max-h-[160px] overflow-y-auto p-2">
            {tempSelectedCompetency.skills.map(skill => (
              <label
                key={skill.id}
                className="flex items-start gap-2.5 rounded-lg p-2 cursor-pointer hover:bg-slate-50 transition"
              >
                <input
                  type="checkbox"
                  checked={tempSelectedSkills.includes(skill.id)}
                  onChange={() => handleToggleSkill(skill.id)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900">{skill.name}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="p-3 border-t border-slate-200">
            <button
              type="button"
              onClick={handleDone}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition"
            >
              Done
            </button>
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {/* Filled Cards */}
      {selectedCompetencies.map((compName, index) => {
        const comp = competencies.find(c => c.name === compName);
        const skills = comp ? selectedSkills[comp.id] || [] : [];
        const skillNames = comp
          ? skills.map(skillId => comp.skills.find(s => s.id === skillId)?.name).filter(Boolean)
          : [];
        const isActive = activeCardIndex === index;

        return (
          <div
            key={`filled-${index}`}
            ref={isActive ? popoverRef : undefined}
            className={`rounded-xl border transition-all h-[260px] ${
              isActive
                ? 'border-slate-900 bg-white shadow-lg'
                : 'border-slate-900 bg-slate-900 hover:bg-slate-800 cursor-pointer'
            }`}
            onClick={() => !isActive && handleOpenCard(index, compName)}
          >
            {isActive ? (
              <div className="h-full flex flex-col">
                {renderDropdownContent()}
              </div>
            ) : (
              <div className="p-4 h-full flex flex-col group">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 flex-shrink-0">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white line-clamp-2 leading-snug">{compName}</p>
                    <p className="text-xs text-white/70 mt-0.5">{skillNames.length} skill{skillNames.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveCard(index, e)}
                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 space-y-1.5 overflow-hidden">
                  {skillNames.length > 0 ? (
                    <>
                      {skillNames.slice(0, 5).map((name, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-white/70 flex-shrink-0" />
                          <span className="text-xs text-white/90 truncate">{name}</span>
                        </div>
                      ))}
                      {skillNames.length > 5 && (
                        <p className="text-xs text-white/50 pl-3.5">+{skillNames.length - 5} more</p>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-300">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
                      <span className="text-xs">Add skills to continue</span>
                    </div>
                  )}
                </div>
                <div className="pt-3 mt-auto border-t border-white/20 flex items-center justify-between">
                  <span className="text-xs text-white/50 group-hover:text-white/70 transition">Click to edit</span>
                  <ArrowRight className="h-3.5 w-3.5 text-white/50 opacity-0 group-hover:opacity-100 group-hover:text-white/70 transition" />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Empty Cards */}
      {Array.from({ length: emptySlots }).map((_, index) => {
        const cardIndex = filledCount + index;
        const isActive = activeCardIndex === cardIndex;

        return (
          <div
            key={`empty-${index}`}
            ref={isActive ? popoverRef : undefined}
            className={`rounded-xl border transition-all h-[260px] ${
              isActive
                ? 'border-slate-900 bg-white shadow-lg'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white cursor-pointer'
            }`}
            onClick={() => !isActive && handleOpenCard(cardIndex)}
          >
            {isActive ? (
              <div className="h-full flex flex-col">
                {renderDropdownContent()}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200">
                  <Sparkles className="h-5 w-5 text-slate-500" />
                </div>
                <span className="text-sm text-slate-500">Select Competency</span>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Card */}
      {availableCompetencies.length > 0 && (
        <div
          ref={activeCardIndex === totalCards ? popoverRef : undefined}
          className={`rounded-xl border-2 transition-all h-[260px] ${
            activeCardIndex === totalCards
              ? 'border-slate-900 bg-white shadow-lg border-solid'
              : 'border-dashed border-slate-300 bg-transparent hover:border-slate-400 cursor-pointer'
          }`}
          onClick={() => activeCardIndex !== totalCards && handleOpenCard(totalCards)}
        >
          {activeCardIndex === totalCards ? (
            <div className="h-full flex flex-col">
              {renderDropdownContent()}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-dashed border-slate-300">
                <Sparkles className="h-5 w-5 text-slate-400" />
              </div>
              <span className="text-sm text-slate-400">Add Competency</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  
  // Fetch competencies from Firestore
  const { competencies, loading: competenciesLoading } = useCompetencies();

  const [showTemplates, setShowTemplates] = useState(true);
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
    setShowTemplates(false);
    setWizardStep(1);
  };

  const handleStartFromScratch = () => {
    setShowTemplates(false);
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
        allowedOrganizations: cleanAllowedOrganizations, // Always include, empty = accessible to all
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

      // Log activity
      await logActivity({
        action: publish ? 'campaign_published' : 'campaign_created',
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || undefined,
        resourceId: newCampaignId,
        resourceName: form.name,
        resourceType: 'campaign',
        metadata: { videosCount: selectedVideos.length },
      });

      router.push(`/campaign?id=${newCampaignId}`);
    } catch (err: any) {
      setError(err?.message || 'Unable to save campaign right now.');
    } finally {
      setLoading(false);
    }
  };

  // Template Selection Screen
  if (showTemplates) {
  return (
    <MainLayout>
        <div className="min-h-[80vh] flex flex-col text-slate-900">
          {/* Centered Content */}
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 mb-6">
                <Sparkles className="h-4 w-4" />
                New Campaign
          </div>
              <h1 className="text-4xl font-semibold text-slate-900 mb-3">How would you like to start?</h1>
              <p className="text-lg text-slate-500">Choose a template to get started quickly, or build from scratch</p>
        </div>

            {/* Options */}
            <div className="w-full max-w-5xl px-6">
              {/* Templates Row */}
              <div className="grid gap-5 sm:grid-cols-3 mb-6">
                {campaignTemplates.map((template, idx) => {
                  const gradients = [
                    'from-sky-500 to-blue-600',
                    'from-amber-500 to-orange-600',
                    'from-violet-500 to-purple-600',
                  ];
                  return (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template.id)}
                      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 text-left transition-all hover:shadow-xl hover:scale-[1.02] hover:border-slate-300"
            >
                      {/* Gradient Header */}
                      <div className={`h-28 bg-gradient-to-br ${gradients[idx]} p-5 flex items-end shrink-0`}>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
                            <Sparkles className="h-4 w-4 text-white" />
              </div>
                          <span className="text-sm font-medium text-white/90">{template.duration}</span>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">{template.name}</h3>
                        <p className="text-sm text-slate-500 mb-4 flex-1">{template.description}</p>
                        <div className="flex flex-wrap gap-1.5">
                {template.competencies.map((tag) => (
                            <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
                      </div>

                      {/* Hover Arrow */}
                      <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur opacity-0 transition group-hover:opacity-100">
                        <ArrowRight className="h-4 w-4 text-white" />
                      </div>
            </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 my-8">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-sm text-slate-400 font-medium">or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Start from Scratch */}
              <button
                onClick={handleStartFromScratch}
                className="group w-full flex items-center justify-between rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 transition hover:border-slate-400 hover:bg-slate-100/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-slate-500 transition group-hover:bg-slate-300 group-hover:text-slate-700">
                    <Play className="h-5 w-5" />
                </div>
                  <div className="text-left">
                    <h3 className="text-base font-semibold text-slate-800">Start from Scratch</h3>
                    <p className="text-sm text-slate-500">Build a fully custom campaign with your own settings</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:text-slate-600 group-hover:translate-x-1" />
              </button>
            </div>

            {/* Back Link */}
            <button
              onClick={() => router.push('/campaigns')}
              className="mt-10 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Campaigns
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen text-slate-900">
        {/* Compact Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowTemplates(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
                <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {activeTemplate ? campaignTemplates.find(t => t.id === activeTemplate)?.name : 'New Campaign'}
              </h1>
              <p className="text-sm text-slate-500">Step {wizardStep} of {wizardSteps.length}</p>
                </div>
              </div>

          {/* Progress Steps - Horizontal Pills */}
          <div className="hidden items-center gap-2 lg:flex">
            {wizardSteps.map((step) => (
              <button
                key={step.id}
                onClick={() => {
                  if (step.id < wizardStep) setWizardStep(step.id);
                }}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  wizardStep === step.id
                    ? 'bg-slate-900 text-white'
                    : wizardStep > step.id
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {wizardStep > step.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">{step.id}</span>
                )}
                {step.label}
              </button>
            ))}
          </div>
          </div>

        {/* Main Content Area */}
        <div className="grid gap-8 lg:grid-cols-[1fr,340px]">
          {/* Left Column - Main Form */}
          <div className="space-y-6">
          {validationMessage && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <Info className="h-4 w-4 flex-shrink-0" />
              {validationMessage}
            </div>
          )}

          {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <X className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {wizardStep === 1 && (
              <>
                {/* Campaign Details Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="text-base font-semibold text-slate-900 mb-5">Campaign Details</h2>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">Campaign Name</label>
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
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                          fieldErrors.has('name') ? 'border-red-400' : 'border-slate-200'
                      }`}
                        placeholder="e.g., Q2 Leadership Development"
                  />
                </div>
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
                      <textarea
                    value={form.description}
                    onChange={(e) => {
                      setForm({ ...form, description: e.target.value });
                      if (fieldErrors.has('description')) {
                        const newErrors = new Set(fieldErrors);
                        newErrors.delete('description');
                        setFieldErrors(newErrors);
                      }
                    }}
                        rows={3}
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                          fieldErrors.has('description') ? 'border-red-400' : 'border-slate-200'
                      }`}
                        placeholder="Brief description of the campaign goals and objectives..."
                  />
                    </div>
                </div>
              </div>

                {/* Competencies & Skills - Card Based */}
                <div>
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">Target Competencies & Skills</h2>
                      <p className="text-sm text-slate-500">Select at least 3 competencies and choose skills for each</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      form.targetCompetencies.length >= 3
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {form.targetCompetencies.length} competencies
                    </span>
                  </div>

                  <CompetencyCardGrid
                    competencies={competencies}
                    selectedCompetencies={form.targetCompetencies}
                    selectedSkills={form.selectedSkills}
                    onUpdate={(targetCompetencies, selectedSkills) => {
                      setForm(prev => ({
                        ...prev,
                        targetCompetencies,
                        selectedSkills,
                      }));
                      setValidationMessage(null);
                      const newErrors = new Set(fieldErrors);
                      newErrors.delete('targetCompetencies');
                      newErrors.delete('selectedSkills');
                      setFieldErrors(newErrors);
                    }}
                  />
                </div>

                {/* Video Selection Card */}
                <div className={`rounded-2xl border bg-white p-6 ${fieldErrors.has('videos') ? 'border-red-300' : 'border-slate-200'}`}>
                  <div className="mb-5 flex items-center justify-between">
                  <div>
                      <h2 className="text-base font-semibold text-slate-900">Video Modules</h2>
                      <p className="text-sm text-slate-500">Select videos to include in this campaign</p>
                  </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={videoSearch}
                        onChange={(e) => setVideoSearch(e.target.value)}
                          placeholder="Search..."
                          className="w-40 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      />
                    </div>
                    <select
                      value={videoFilter}
                      onChange={(e) => setVideoFilter(e.target.value as 'all' | Video['source'])}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    >
                        <option value="all">All</option>
                        <option value="generated">AI</option>
                      <option value="uploaded">Uploaded</option>
                    </select>
                  </div>
                </div>

                {videoError && (
                    <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>{videoError}</span>
                      <button type="button" onClick={loadVideos} className="text-xs font-semibold underline">Retry</button>
                  </div>
                )}

                {videosLoading ? (
                    <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : filteredVideos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center">
                      <Play className="mb-3 h-8 w-8 text-slate-300" />
                    <p className="text-sm text-slate-500">
                        {availableVideos.length === 0 ? 'No videos in your library yet' : 'No matching videos'}
                    </p>
                  </div>
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredVideos.map((video) => {
                      const isSelected = selectedVideoIds.has(video.id);
                      return (
                        <button
                          key={video.id}
                          type="button"
                          onClick={() => handleVideoToggle(video)}
                            className={`group relative flex flex-col overflow-hidden rounded-xl border transition ${
                              isSelected
                                ? 'border-slate-900 ring-2 ring-slate-900'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <div className="relative aspect-video bg-slate-100">
                            {video.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                                <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <Play className="h-8 w-8 text-slate-300" />
                              </div>
                            )}
                              {isSelected && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                                    <Check className="h-4 w-4 text-slate-900" />
                          </div>
                                </div>
                              )}
                              <span className={`absolute right-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-medium ${
                                video.source === 'generated' ? 'bg-violet-500 text-white' : 'bg-slate-900 text-white'
                              }`}>
                                {video.source === 'generated' ? 'AI' : 'Upload'}
                              </span>
                            </div>
                            <div className="p-3">
                              <p className="line-clamp-1 text-sm font-medium text-slate-900">{video.title}</p>
                              <p className="text-xs text-slate-500">
                                {formatVideoDuration(video.duration)}
                              </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              </>
          )}

          {wizardStep === 2 && (
            <>
              {/* Organization Access Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-5">
                  <h2 className="text-base font-semibold text-slate-900">Organization Access</h2>
                  <p className="text-sm text-slate-500">Select which organizations can participate in this campaign</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {organizationsLoading ? (
                    <div className="col-span-full flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : organizationError ? (
                    <div className="col-span-full rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {organizationError}
                    </div>
                  ) : availableOrganizations.length === 0 ? (
                    <div className="col-span-full rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
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

              </div>

              {/* Privacy Settings Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-5">Privacy Settings</h2>
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                      <Users className="h-5 w-5 text-slate-600" />
                    </div>
                  <div>
                      <p className="text-sm font-medium text-slate-900">Anonymous Responses</p>
                      <p className="text-xs text-slate-500">Hide participant identity in reports</p>
                  </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={form.anonymousResponses}
                      onChange={(e) => setForm({ ...form, anonymousResponses: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`h-6 w-11 rounded-full transition ${form.anonymousResponses ? 'bg-slate-900' : 'bg-slate-200'}`}>
                      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.anonymousResponses ? 'left-[22px]' : 'left-0.5'}`} />
                </div>
              </div>
                </label>
            </div>
            </>
          )}

          {wizardStep === 3 && (
            <>
              {/* Schedule Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-5">Campaign Schedule</h2>
                <div className="grid gap-5 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => {
                      setForm({ ...form, startDate: e.target.value });
                      if (fieldErrors.has('startDate')) {
                        const newErrors = new Set(fieldErrors);
                        newErrors.delete('startDate');
                        if (form.endDate && new Date(e.target.value) <= new Date(form.endDate)) {
                          newErrors.delete('endDate');
                        }
                        setFieldErrors(newErrors);
                      }
                    }}
                      className={`w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                        fieldErrors.has('startDate') ? 'border-red-400' : 'border-slate-200'
                      }`}
                  />
                </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => {
                      setForm({ ...form, endDate: e.target.value });
                      if (fieldErrors.has('endDate')) {
                        const newErrors = new Set(fieldErrors);
                        newErrors.delete('endDate');
                        if (form.startDate && new Date(form.startDate) <= new Date(e.target.value)) {
                          newErrors.delete('startDate');
                        }
                        setFieldErrors(newErrors);
                      }
                    }}
                      className={`w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                        fieldErrors.has('endDate') ? 'border-red-400' : 'border-slate-200'
                      }`}
                  />
                </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Frequency</label>
                  <select
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value as (typeof frequencyOptions)[number] })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  >
                    {frequencyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                    </div>
                
                {/* Recurring Campaign Info */}
                {form.frequency !== 'once' && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                    <RefreshCw className="h-5 w-5 text-sky-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-sky-900">Recurring Campaign</p>
                      <p className="text-sky-700 mt-1">
                        This campaign will automatically create new instances {form.frequency}. 
                        Each instance will re-enroll participants and track progress separately.
                        {form.frequency === 'weekly' && ' New instances are created every Monday.'}
                        {form.frequency === 'monthly' && ' New instances are created on the 1st of each month.'}
                        {form.frequency === 'quarterly' && ' New instances are created every 3 months.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Automation Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-5">Automation Settings</h2>
                <div className="space-y-3">
                  {[
                    { key: 'autoSendInvites', icon: Mail, label: 'Auto-send Invitations', desc: 'Automatically email participants when campaign starts' },
                    { key: 'sendReminders', icon: Bell, label: 'Send Reminders', desc: 'Nudge participants who haven\'t completed' },
                    { key: 'sendConfirmations', icon: CheckCircle2, label: 'Send Confirmations', desc: 'Email confirmation upon completion' },
                  ].map(({ key, icon: Icon, label, desc }) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50"
                      >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                          <Icon className="h-5 w-5 text-slate-600" />
                  </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{label}</p>
                          <p className="text-xs text-slate-500">{desc}</p>
                </div>
                    </div>
                      <div className="relative">
                      <input
                        type="checkbox"
                          checked={form[key as keyof typeof form] as boolean}
                          onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                        className="sr-only"
                      />
                        <div className={`h-6 w-11 rounded-full transition ${form[key as keyof typeof form] ? 'bg-slate-900' : 'bg-slate-200'}`}>
                          <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form[key as keyof typeof form] ? 'left-[22px]' : 'left-0.5'}`} />
                  </div>
                </div>
                    </label>
                  ))}
              </div>
              </div>
            </>
          )}

                  </div>

          {/* Right Column - Summary Sidebar */}
          <div className="space-y-6">
            {/* Selected Videos Summary */}
            {selectedVideos.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Selected Videos</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedVideos([])}
                    className="text-xs text-slate-500 hover:text-slate-900"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-2">
                  {selectedVideos.map((video, index) => (
                    <div key={video.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-xs font-medium text-white">
                        {index + 1}
                    </span>
                      <span className="flex-1 truncate text-sm text-slate-700">{video.title}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveVideo(video.id, 'up')}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        >
                          <MoveUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={index === selectedVideos.length - 1}
                          onClick={() => handleMoveVideo(video.id, 'down')}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        >
                          <MoveDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVideoToggle(video)}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

            {/* Action Buttons - Sticky */}
            <div className="sticky bottom-6 space-y-3">
              <div className="flex gap-2">
              {wizardStep > 1 && (
                <button
                  onClick={handlePrevStep}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}

                {wizardStep < 3 ? (
                <button
                  onClick={handleNextStep}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                    Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
                ) : (
                  <div className="flex flex-1 gap-2">
                  <button
                    onClick={() => persistCampaign(false)}
                    disabled={loading}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                      {loading ? 'Saving…' : 'Draft'}
                  </button>
                  <button
                    onClick={() => persistCampaign(true)}
                    disabled={loading}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                      <Sparkles className="h-4 w-4" />
                      {loading ? 'Launching…' : 'Launch'}
                  </button>
                  </div>
              )}
              </div>

              {/* Mobile Step Indicator */}
              <div className="flex items-center justify-center gap-2 lg:hidden">
                {wizardSteps.map((step) => (
                  <div
                    key={step.id}
                    className={`h-2 w-2 rounded-full transition ${
                      wizardStep >= step.id ? 'bg-slate-900' : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
