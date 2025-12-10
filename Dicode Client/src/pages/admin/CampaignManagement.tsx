import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Employee,
  Campaign as FirestoreCampaign,
  Cohort,
  UserRole,
} from '@/types';
import {
  Search,
  Plus,
  ArrowLeft,
  ArrowRight,
  Check,
  Video as VideoIcon,
  Users,
  Calendar,
  Save,
  Play,
  Share2,
  MoreVertical,
  LayoutGrid,
  List,
  Megaphone,
  BarChart2,
  PlayCircle,
  FileText,
  CheckCircle,
  CheckCircle2,
  Pin,
  TrendingUp,
  Pause,
  Copy,
  Trash2,
  Edit,
  Upload,
  X,
  Building2,
  UserCheck,
  Mail,
  Bell,
  AlertTriangle,
  Loader2,
  Shield,
  Target,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCampaignsByOrganization,
  getCampaignsForAdmin,
  createCampaign as createCampaignDoc,
  setCampaignPublishState,
  deleteCampaign as deleteCampaignDoc,
  getCohortsByOrganization,
  updateCampaign,
  getAllVideos,
  createCampaignItem,
  getUsersByOrganization,
  getCampaignEnrollments,
  getCampaign,
  enrollUserInCampaign,
} from '@/lib/firestore';
import { COMPETENCIES, type SkillDefinition } from '@/lib/competencies';
import type { Video } from '@/types';
import { CampaignGridSkeleton } from '@/components/shared/Skeleton';
import Avatar from '@/components/shared/Avatar';

// Types
interface Campaign {
  id: string;
  name: string;
  description: string;
  purpose: string;
  status: 'active' | 'draft' | 'completed';
  startDate: Date;
  endDate: Date;
  frequency: 'once' | 'weekly' | 'monthly' | 'quarterly';
  targetCompetencies: string[];
  selectedSkills?: Record<string, string[]>; // Maps competency ID to array of skill IDs
  campaignType: string; // Template ID (e.g., 'leadership-checkin', 'competency-pulse', 'skills-tomorrow', 'custom')
  participants: Participant[];
  anonymousResponses: boolean;
  cohortGroup?: string;
  autoSendInvites: boolean;
  sendReminders: boolean;
  sendConfirmations: boolean;
  oneTimeAccess: boolean;
  completionRate: number;
  totalResponses: number;
  createdDate: Date;
  updatedDate: Date;
  source?: 'dicode' | 'organization'; // 'dicode' = created by DiCode team, 'organization' = created by client
  pinned?: boolean; // Whether campaign is pinned for quick access
  allowedOrganizations?: string[]; // Organizations that can access this campaign
  allowedDepartments?: string[];
  allowedEmployeeIds?: string[];
  allowedCohortIds?: string[];
  allowedRoles?: UserRole[];
  customContent?: { id: string; title: string; type: 'video' | 'content' }[]; // Campaign videos/content items
}

interface Participant {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  region: string;
}

interface CampaignType {
  id: 'leadership-checkin' | 'culture-pulse' | 'future-skills';
  name: string;
  description: string;
  color: string;
  icon: string;
  iconComponent?: React.ComponentType<{ size?: number; className?: string }>;
  skills: SkillDefinition[];
}

// DiCode campaigns are loaded from Firestore (created by DiCode team, accessible to organization)

// Campaign templates for creation wizard
const campaignTypes: CampaignType[] = [
  {
    id: 'leadership-checkin',
    name: 'Leadership Check-In',
    description: 'Pulse on leadership behaviors to reinforce trust and alignment',
    color: 'from-blue-500 to-blue-700',
    icon: '👥',
    iconComponent: UserCheck,
    skills: [
      { id: 'psych-safety', name: 'Psychological Safety', description: 'Build trust and openness' },
      { id: 'collaboration', name: 'Collaboration', description: 'Strengthen teamwork' },
      { id: 'prosocial', name: 'Prosocial Norms', description: 'Foster constructive dialogue' },
    ],
  },
  {
    id: 'culture-pulse',
    name: 'Culture & Equity Pulse',
    description: 'Track inclusion, bias, and belonging across teams',
    color: 'from-purple-500 to-purple-700',
    icon: '🌍',
    iconComponent: TrendingUp,
    skills: [
      { id: 'inclusion', name: 'Inclusion', description: 'Foster diverse perspectives' },
      { id: 'belonging', name: 'Belonging', description: 'Create psychological safety' },
      { id: 'equity', name: 'Equity', description: 'Ensure fair opportunities' },
    ],
  },
  {
    id: 'future-skills',
    name: 'Future Skills Sprint',
    description: 'Upskill leaders on adaptability, innovation, and resilience',
    color: 'from-green-500 to-green-700',
    icon: '🚀',
    iconComponent: Building2,
    skills: [
      { id: 'adaptability', name: 'Adaptability', description: 'Navigate change effectively' },
      { id: 'innovation', name: 'Innovation', description: 'Drive creative solutions' },
      { id: 'resilience', name: 'Resilience', description: 'Bounce back from setbacks' },
    ],
  },
];

type TargetingMode = 'all' | 'departments' | 'cohorts' | 'employees' | 'roles';

// Competency Card Grid Component
interface CompetencyCardGridProps {
  competencies: typeof COMPETENCIES;
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
  const [tempSelectedCompetency, setTempSelectedCompetency] = useState<typeof COMPETENCIES[0] | null>(null);
  const [tempSelectedSkills, setTempSelectedSkills] = useState<string[]>([]);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Minimum 3 cards, plus filled cards, plus Add button
  const filledCount = selectedCompetencies.length;
  const emptySlots = Math.max(0, 3 - filledCount);
  const totalCards = filledCount + emptySlots;

  // Available competencies (not already selected)
  const availableCompetencies = competencies.filter(
    comp => !selectedCompetencies.includes(comp.name)
  );

  // Close popover when clicking outside
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

  const handleSelectCompetency = (comp: typeof COMPETENCIES[0]) => {
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

    // Check if this card already had a competency (editing mode)
    const cardIndex = activeCardIndex!;
    const existingCompName = cardIndex < filledCount ? selectedCompetencies[cardIndex] : null;

    if (existingCompName) {
      // Replace existing competency
      const existingComp = competencies.find(c => c.name === existingCompName);
      if (existingComp) {
        delete newSelectedSkills[existingComp.id];
      }
      newSelectedCompetencies[cardIndex] = tempSelectedCompetency.name;
    } else {
      // Add new competency
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

  // Render dropdown content (reusable for all card types)
  const renderDropdownContent = () => {
    if (popoverStep === 'competencies') {
      return (
        <>
          <div className="p-3 border-b border-dark-border">
            <p className="text-sm font-semibold text-dark-text">Select Competency</p>
          </div>
          <div className="max-h-[200px] overflow-y-auto p-2">
            {availableCompetencies.length > 0 ? (
              availableCompetencies.map(comp => (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => handleSelectCompetency(comp)}
                  className="w-full flex items-start gap-3 rounded-lg p-2.5 text-left hover:bg-dark-bg transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-dark-text">{comp.name}</p>
                    <p className="text-xs text-dark-text-muted line-clamp-1">{comp.description}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-dark-text-muted -rotate-90 flex-shrink-0 mt-0.5" />
                </button>
              ))
            ) : (
              <p className="text-sm text-dark-text-muted text-center py-4">All competencies selected</p>
            )}
          </div>
        </>
      );
    }

    if (popoverStep === 'skills' && tempSelectedCompetency) {
      return (
        <>
          <div className="flex items-center gap-2 p-3 border-b border-dark-border">
            <button
              type="button"
              onClick={handleBackToCompetencies}
              className="p-1 rounded-md hover:bg-dark-bg transition"
            >
              <ArrowLeft className="h-4 w-4 text-dark-text-muted" />
            </button>
            <p className="text-sm font-semibold text-dark-text truncate">{tempSelectedCompetency.name}</p>
          </div>
          <div className="max-h-[160px] overflow-y-auto p-2">
            {tempSelectedCompetency.skills.map(skill => (
              <label
                key={skill.id}
                className="flex items-start gap-2.5 rounded-lg p-2 cursor-pointer hover:bg-dark-bg transition"
              >
                <input
                  type="checkbox"
                  checked={tempSelectedSkills.includes(skill.id)}
                  onChange={() => handleToggleSkill(skill.id)}
                  className="mt-0.5 h-4 w-4 rounded border-dark-border bg-dark-bg text-primary focus:ring-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-dark-text">{skill.name}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="p-3 border-t border-dark-border">
            <button
              type="button"
              onClick={handleDone}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition"
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
            className={`rounded-xl border transition-all h-[240px] flex flex-col ${isActive
              ? 'border-primary bg-dark-card shadow-lg z-10 relative'
              : 'border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer'
              } `}
            onClick={() => !isActive && handleOpenCard(index, compName)}
          >
            {isActive ? (
              // Dropdown mode - show inside card
              <div className="h-full flex flex-col">
                {renderDropdownContent()}
              </div>
            ) : (
              // Display mode - show competency info
              <div className="p-4 h-full flex flex-col group">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 flex-shrink-0">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white line-clamp-2 leading-snug">{compName}</p>
                    <p className="text-xs text-white/50 mt-1">{skillNames.length} skill{skillNames.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveCard(index, e)}
                    className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 space-y-1.5 overflow-hidden">
                  {skillNames.length > 0 ? (
                    <>
                      {skillNames.slice(0, 3).map((name, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                          <span className="text-xs text-white/80 truncate">{name}</span>
                        </div>
                      ))}
                      {skillNames.length > 3 && (
                        <p className="text-xs text-white/40 pl-3.5">+{skillNames.length - 3} more</p>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-400">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-xs">Add skills to continue</span>
                    </div>
                  )}
                </div>
                <div className="pt-3 mt-auto border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs text-white/40 group-hover:text-primary transition">Click to edit</span>
                  <ArrowRight className="h-3.5 w-3.5 text-white/40 opacity-0 group-hover:opacity-100 group-hover:text-primary transition" />
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
            className={`rounded-xl border transition-all h-[240px] flex flex-col ${isActive
              ? 'border-primary bg-dark-card shadow-lg z-10 relative'
              : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10 cursor-pointer'
              } `}
            onClick={() => !isActive && handleOpenCard(cardIndex)}
          >
            {isActive ? (
              // Dropdown mode
              <div className="h-full flex flex-col">
                {renderDropdownContent()}
              </div>
            ) : (
              // Empty state
              <div className="h-full flex flex-col items-center justify-center gap-4 p-4 text-center">
                <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center">
                  <Plus className="h-6 w-6 text-white/20" />
                </div>
                <div>
                  <span className="text-sm font-medium text-white/40 block mb-1">Select Competency</span>
                  <span className="text-xs text-white/20">Click to choose</span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Card (dashed border) - only show if there are available competencies */}
      {availableCompetencies.length > 0 && (
        <div
          ref={activeCardIndex === totalCards ? popoverRef : undefined}
          className={`rounded-xl border-2 transition-all h-[240px] flex flex-col ${activeCardIndex === totalCards
            ? 'border-primary bg-dark-card shadow-lg border-solid z-10 relative'
            : 'border-dashed border-white/10 bg-transparent hover:border-white/30 cursor-pointer'
            } `}
          onClick={() => activeCardIndex !== totalCards && handleOpenCard(totalCards)}
        >
          {activeCardIndex === totalCards ? (
            // Dropdown mode
            <div className="h-full flex flex-col">
              {renderDropdownContent()}
            </div>
          ) : (
            // Add button state
            <div className="h-full flex flex-col items-center justify-center gap-4 p-4 text-center">
              <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center">
                <Plus className="h-6 w-6 text-white/40" />
              </div>
              <div>
                <span className="text-sm font-medium text-white/60 block mb-1">Add Competency</span>
                <span className="text-xs text-white/30">Expand your selection</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CampaignManagement = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Main tab state - sync with URL params for breadcrumb support
  const [activeTab, setActiveTabState] = useState<'active' | 'draft' | 'completed' | 'create' | 'dicode'>(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab === 'create') return 'create';
    return 'active';
  });

  // Wrapper to sync tab state with URL
  const setActiveTab = useCallback((tab: 'active' | 'draft' | 'completed' | 'create' | 'dicode') => {
    setActiveTabState(tab);
    if (tab === 'create') {
      setSearchParams({ tab: 'create' });
    } else {
      // Remove tab param when not creating
      searchParams.delete('tab');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  // Create campaign wizard state
  const [wizardStep, setWizardStep] = useState(1);
  // Check for edit param immediately to show wizard without delay
  const editParamOnMount = searchParams.get('edit');
  const [showCreateWizard, setShowCreateWizard] = useState(!!editParamOnMount);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(editParamOnMount);
  const [loadingEditCampaign, setLoadingEditCampaign] = useState(!!editParamOnMount);
  const [competencyValidationError, setCompetencyValidationError] = useState<string>('');
  const [viewingCampaignId, setViewingCampaignId] = useState<string | null>(null);

  // Video selection state
  const [availableVideos, setAvailableVideos] = useState<Video[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);

  // Video search and filter state
  const [videoSearchQuery, setVideoSearchQuery] = useState('');
  const [selectedVideoCompetency, setSelectedVideoCompetency] = useState<string>('all');
  const [videoSourceFilter, setVideoSourceFilter] = useState<'all' | 'generated' | 'uploaded'>('all');
  const [videoSortBy, setVideoSortBy] = useState<string>('date-desc');  // Pagination
  const [videoPage, setVideoPage] = useState(0);
  const VIDEOS_PER_PAGE = 6;

  // Employee list (loaded from Firestore)
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  // Deprecated/Unused legacy filter states (keeping for safety if referenced elsewhere, though should be cleaned up)
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [employeeDepartmentFilter, setEmployeeDepartmentFilter] = useState<string>('all');
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState<string>('all');
  const [employeeRegionFilter, setEmployeeRegionFilter] = useState<string>('all');
  const [employeeCohortFilter, setEmployeeCohortFilter] = useState<string>('all');

  // Available cohorts for targeting
  const [availableCohorts, setAvailableCohorts] = useState<Cohort[]>([]);

  const [targetingMode, setTargetingMode] = useState<TargetingMode>('all');
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});
  const [completionRates, setCompletionRates] = useState<Record<string, number>>({});
  const [eligibleCounts, setEligibleCounts] = useState<Record<string, number>>({});

  // Generate unique departments from employees
  const uniqueDepartments = useMemo(() => {
    const depts = new Set<string>();
    availableEmployees.forEach(emp => {
      if (emp.department) {
        depts.add(emp.department);
      }
    });
    return Array.from(depts).sort();
  }, [availableEmployees]);

  const cohortMap = useMemo(() => {
    const map = new Map<string, Cohort>();
    availableCohorts.forEach(cohort => map.set(cohort.id, cohort));
    return map;
  }, [availableCohorts]);

  // Campaign form state
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    description: '',
    targetCompetencies: [] as string[],
    frequency: 'monthly' as 'once' | 'weekly' | 'monthly' | 'quarterly',
    campaignType: null as string | null,
    participants: [] as Participant[],
    anonymousResponses: false,
    cohortGroup: '',
    startDate: '',
    endDate: '',
    oneTimeAccess: false,
    autoSendInvites: true,
    sendReminders: true,
    sendConfirmations: true,
    selectedCompetency: null as string | null,
    selectedSkills: {} as Record<string, string[]>, // Maps competency ID to array of skill IDs
    customContent: [] as { id: string; title: string; type: 'video' | 'content' }[],
    // Granular targeting within user's organization (NO org selector - auto-assigned)
    allowedDepartments: [] as string[],
    allowedEmployeeIds: [] as string[],
    allowedCohortIds: [] as string[],
    allowedRoles: [] as UserRole[],
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // DiCode enrollment modal state
  const [enrollmentModalCampaign, setEnrollmentModalCampaign] = useState<Campaign | null>(null);
  const [enrollmentSelectedEmployees, setEnrollmentSelectedEmployees] = useState<string[]>([]);
  const [enrollmentSelectedDepartments, setEnrollmentSelectedDepartments] = useState<string[]>([]);
  const [enrollmentSelectedCohorts, setEnrollmentSelectedCohorts] = useState<string[]>([]);
  const [enrollmentSearchQuery, setEnrollmentSearchQuery] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentPage, setEnrollmentPage] = useState(0);
  const ENROLLMENT_PER_PAGE = 10;

  const targetingOptions: Array<{ id: TargetingMode; label: string; description: string }> = [
    {
      id: 'all',
      label: 'All Employees',
      description: 'Everyone in your organization',
    },
    {
      id: 'departments',
      label: 'Departments',
      description: 'Target specific departments',
    },
    {
      id: 'cohorts',
      label: 'Cohorts',
      description: 'Target saved cohorts/groups',
    },
    {
      id: 'roles',
      label: 'Specific Roles',
      description: 'Target applicants or employees specifically',
    },
    {
      id: 'employees',
      label: 'Specific Employees',
      description: 'Hand-pick individual employees',
    },
  ];

  const buildParticipantsFromIds = useCallback(
    (ids: string[]): Participant[] => {
      return ids
        .map(id => availableEmployees.find(emp => emp.id === id))
        .filter((emp): emp is Employee => Boolean(emp))
        .map(emp => ({
          id: emp.id,
          name: emp.name,
          email: emp.email,
          department: emp.department || 'N/A',
          role: emp.role || 'Employee',
          region: 'N/A',
        }));
    },
    [availableEmployees]
  );

  useEffect(() => {
    if (targetingMode !== 'employees') return;
    setCampaignForm(prev => {
      const newParticipants = buildParticipantsFromIds(selectedEmployeeIds);
      const participantsChanged =
        newParticipants.length !== prev.participants.length ||
        newParticipants.some((participant, index) => participant.id !== prev.participants[index]?.id);
      const employeeIdsChanged =
        selectedEmployeeIds.length !== (prev.allowedEmployeeIds?.length || 0) ||
        selectedEmployeeIds.some((id, index) => id !== prev.allowedEmployeeIds?.[index]);

      if (!participantsChanged && !employeeIdsChanged) {
        return prev;
      }

      return {
        ...prev,
        participants: newParticipants,
        allowedEmployeeIds: [...selectedEmployeeIds],
      };
    });
  }, [buildParticipantsFromIds, selectedEmployeeIds, targetingMode]);

  const getEligibleCountForConfig = useCallback(
    (config: { allowedDepartments?: string[] | null; allowedEmployeeIds?: string[] | null; allowedCohortIds?: string[] | null; allowedRoles?: UserRole[] | null }) => {
      if (config.allowedEmployeeIds != null) {
        return config.allowedEmployeeIds.length;
      }

      if (config.allowedDepartments != null) {
        if (config.allowedDepartments.length === 0) {
          return 0;
        }
        return availableEmployees.filter(
          emp => emp.department && config.allowedDepartments!.includes(emp.department)
        ).length;
      }

      if (config.allowedCohortIds != null) {
        if (config.allowedCohortIds.length === 0) {
          return 0;
        }
        const memberIds = new Set<string>();
        config.allowedCohortIds.forEach(cohortId => {
          const cohort = cohortMap.get(cohortId);
          cohort?.employeeIds?.forEach(id => memberIds.add(id));
        });
        return memberIds.size;
      }

      if (config.allowedRoles != null) {
        if (config.allowedRoles.length === 0) {
          return 0;
        }
        return availableEmployees.filter(
          emp => emp.role && config.allowedRoles!.includes(emp.role)
        ).length;
      }

      return availableEmployees.length;
    },
    [availableEmployees, cohortMap]
  );

  useEffect(() => {
    if (campaigns.length === 0) {
      setEligibleCounts({});
      return;
    }

    const nextCounts: Record<string, number> = {};
    campaigns.forEach(campaign => {
      nextCounts[campaign.id] = getEligibleCountForConfig({
        allowedDepartments: campaign.allowedDepartments,
        allowedEmployeeIds: campaign.allowedEmployeeIds,
        allowedCohortIds: campaign.allowedCohortIds,
        allowedRoles: campaign.allowedRoles,
      });
    });
    setEligibleCounts(nextCounts);
  }, [campaigns, getEligibleCountForConfig]);

  const handleTargetingModeChange = (mode: TargetingMode) => {
    setTargetingMode(mode);
    if (mode !== 'employees' && selectedEmployeeIds.length > 0) {
      setSelectedEmployeeIds([]);
    }
    setCampaignForm(prev => ({
      ...prev,
      participants: mode === 'employees' ? prev.participants : [],
      allowedEmployeeIds: mode === 'employees' ? prev.allowedEmployeeIds : [],
      allowedDepartments: mode === 'departments' ? prev.allowedDepartments : [],
      allowedCohortIds: mode === 'cohorts' ? prev.allowedCohortIds : [],
      allowedRoles: mode === 'roles' ? prev.allowedRoles : [],
    }));
  };

  const toggleDepartmentSelection = (department: string) => {
    if (targetingMode !== 'departments') return;
    setCampaignForm(prev => {
      const isSelected = prev.allowedDepartments.includes(department);
      const next = isSelected
        ? prev.allowedDepartments.filter(dep => dep !== department)
        : [...prev.allowedDepartments, department];
      return { ...prev, allowedDepartments: next };
    });
  };

  const toggleCohortSelection = (cohortId: string) => {
    if (targetingMode !== 'cohorts') return;
    setCampaignForm(prev => {
      const isSelected = prev.allowedCohortIds.includes(cohortId);
      const next = isSelected
        ? prev.allowedCohortIds.filter(id => id !== cohortId)
        : [...prev.allowedCohortIds, cohortId];
      return { ...prev, allowedCohortIds: next };
    });
  };



  const deriveTargetingModeFromCampaign = useCallback((campaign: Campaign): TargetingMode => {
    if (campaign.allowedEmployeeIds && campaign.allowedEmployeeIds.length > 0) {
      return 'employees';
    }
    if (campaign.allowedRoles && campaign.allowedRoles.length > 0) {
      return 'roles';
    }
    if (campaign.allowedDepartments && campaign.allowedDepartments.length > 0) {
      return 'departments';
    }
    if (campaign.allowedCohortIds && campaign.allowedCohortIds.length > 0) {
      return 'cohorts';
    }
    return 'all';
  }, []);

  const currentEligibleCount = useMemo(() => {
    if (targetingMode === 'departments') {
      return getEligibleCountForConfig({ allowedDepartments: campaignForm.allowedDepartments });
    }
    if (targetingMode === 'cohorts') {
      return getEligibleCountForConfig({ allowedCohortIds: campaignForm.allowedCohortIds });
    }
    if (targetingMode === 'employees') {
      return getEligibleCountForConfig({ allowedEmployeeIds: campaignForm.allowedEmployeeIds });
    }
    if (targetingMode === 'roles') {
      return getEligibleCountForConfig({ allowedRoles: campaignForm.allowedRoles });
    }
    return getEligibleCountForConfig({});
  }, [
    campaignForm.allowedDepartments,
    campaignForm.allowedCohortIds,
    campaignForm.allowedEmployeeIds,
    campaignForm.allowedRoles,
    getEligibleCountForConfig,
    getEligibleCountForConfig,
    targetingMode,
  ]);

  const loadEnrollmentCounts = useCallback(async (campaignList: Campaign[]) => {
    const orgId = user?.organization;
    if (campaignList.length === 0 || !orgId) {
      setEnrollmentCounts({});
      setCompletionRates({});
      return;
    }

    const countResults: Record<string, number> = {};
    const completionResults: Record<string, number> = {};

    await Promise.all(
      campaignList.map(async (campaign) => {
        try {
          const enrollments = await getCampaignEnrollments(campaign.id, orgId);
          countResults[campaign.id] = enrollments.length;

          // Calculate real completion rate from enrollment statuses
          if (enrollments.length > 0) {
            const completedCount = enrollments.filter(e => e.status === 'completed').length;
            completionResults[campaign.id] = Math.round((completedCount / enrollments.length) * 100);
          } else {
            completionResults[campaign.id] = 0;
          }
        } catch (error) {
          console.error('Failed to fetch enrollments for campaign', campaign.id, error);
        }
      })
    );

    setEnrollmentCounts(countResults);
    setCompletionRates(completionResults);
  }, [user?.organization]);

  const getEnrollmentSummary = useCallback(
    (campaign: Campaign) => {
      const enrolled = enrollmentCounts[campaign.id] ?? 0;
      const eligible = eligibleCounts[campaign.id];
      if (!eligible || eligible <= 0) {
        return `${enrolled} enrolled`;
      }
      const rate = Math.min(100, Math.round((enrolled / eligible) * 100));
      return `${enrolled}/${eligible} (${rate}% enrolled)`;
    },
    [eligibleCounts, enrollmentCounts]
  );

  const mapCampaignDocToUI = useCallback((campaignDoc: FirestoreCampaign): Campaign => {
    const createdAt = campaignDoc.metadata.createdAt ? new Date(campaignDoc.metadata.createdAt) : new Date();
    const updatedAt = campaignDoc.metadata.updatedAt ? new Date(campaignDoc.metadata.updatedAt) : createdAt;
    const itemCount = campaignDoc.items?.length || 0;

    // Map campaign items to customContent
    const customContent = (campaignDoc.items || []).map((item, index) => ({
      id: item.id,
      title: `Video ${index + 1}`, // Default title - ideally fetch from videos collection
      type: 'video' as const,
    }));

    console.log('[CampaignManagement] Mapping campaign:', {
      id: campaignDoc.id,
      title: campaignDoc.title,
      itemCount,
      items: campaignDoc.items,
      customContent,
    });

    return {
      id: campaignDoc.id,
      name: campaignDoc.title,
      description: campaignDoc.description,
      purpose: campaignDoc.skillFocus,
      status: campaignDoc.metadata.isPublished ? 'active' : 'draft',
      startDate: createdAt,
      endDate: updatedAt,
      frequency: campaignDoc.schedule?.frequency || 'monthly',
      targetCompetencies: campaignDoc.metadata.tags || [],
      selectedSkills: {},
      campaignType: campaignDoc.campaignType || 'custom',
      participants: [],
      anonymousResponses: campaignDoc.anonymousResponses || false,
      cohortGroup: '',
      autoSendInvites: campaignDoc.automation?.autoSendInvites ?? true,
      sendReminders: campaignDoc.automation?.sendReminders ?? true,
      sendConfirmations: campaignDoc.automation?.sendConfirmations ?? true,
      oneTimeAccess: campaignDoc.accessControl?.oneTimeAccess || false,
      completionRate: Math.min(100, itemCount * 10),
      totalResponses: itemCount,
      createdDate: createdAt,
      updatedDate: updatedAt,
      source: campaignDoc.source,
      pinned: campaignDoc.pinned || false,
      allowedOrganizations: campaignDoc.allowedOrganizations,
      allowedDepartments: campaignDoc.allowedDepartments || [],
      allowedEmployeeIds: campaignDoc.allowedEmployeeIds || [],
      allowedCohortIds: campaignDoc.allowedCohortIds || [],
      customContent,
    };
  }, []);

  const refreshCampaigns = useCallback(async () => {
    if (!user?.id) {
      setCampaigns([]);
      setCampaignsLoading(false);
      return;
    }

    setCampaignError(null);
    setCampaignsLoading(true);
    try {
      const data =
        user.role === 'admin'
          ? await getCampaignsForAdmin(user.organization)
          : await getCampaignsByOrganization(
            user.organization,
            user.department,
            user.id,
            user.cohortIds
          );
      const mappedCampaigns = data.map(mapCampaignDocToUI);
      setCampaigns(mappedCampaigns);
      loadEnrollmentCounts(mappedCampaigns);
    } catch (error) {
      console.error('Failed to load campaigns', error);
      setCampaignError('Unable to load campaigns right now. Please try again.');
    } finally {
      setCampaignsLoading(false);
    }
  }, [loadEnrollmentCounts, mapCampaignDocToUI, user?.organization, user?.department, user?.id, user?.cohortIds]);

  useEffect(() => {
    refreshCampaigns();
  }, [refreshCampaigns]);

  // Handle edit param from URL (e.g., from CampaignDetails page)
  // Fetches campaign directly for immediate editor opening
  useEffect(() => {
    const editCampaignId = searchParams.get('edit');
    if (!editCampaignId) {
      setLoadingEditCampaign(false);
      return;
    }

    const loadCampaignForEdit = async () => {
      setLoadingEditCampaign(true);
      try {
        // First check if campaign is already in local state
        let campaignToEdit = campaigns.find(c => c.id === editCampaignId);

        // If not found locally, fetch directly from Firestore
        if (!campaignToEdit) {
          const fetchedCampaign = await getCampaign(editCampaignId);
          if (fetchedCampaign) {
            campaignToEdit = mapCampaignDocToUI(fetchedCampaign);
          }
        }

        if (campaignToEdit) {
          // Populate form with existing campaign data
          setCampaignForm({
            name: campaignToEdit.name,
            description: campaignToEdit.description,
            targetCompetencies: campaignToEdit.targetCompetencies || [],
            frequency: campaignToEdit.frequency,
            campaignType: campaignToEdit.campaignType || null,
            participants: campaignToEdit.participants || [],
            anonymousResponses: campaignToEdit.anonymousResponses,
            cohortGroup: campaignToEdit.cohortGroup || '',
            startDate: campaignToEdit.startDate ? new Date(campaignToEdit.startDate).toISOString().split('T')[0] : '',
            endDate: campaignToEdit.endDate ? new Date(campaignToEdit.endDate).toISOString().split('T')[0] : '',
            oneTimeAccess: campaignToEdit.oneTimeAccess,
            autoSendInvites: campaignToEdit.autoSendInvites,
            sendReminders: campaignToEdit.sendReminders,
            sendConfirmations: campaignToEdit.sendConfirmations,
            selectedCompetency: null,
            selectedSkills: campaignToEdit.selectedSkills || {},
            customContent: [],
            allowedDepartments: campaignToEdit.allowedDepartments || [],
            allowedEmployeeIds: campaignToEdit.allowedEmployeeIds || [],
            allowedCohortIds: campaignToEdit.allowedCohortIds || [],
            allowedRoles: campaignToEdit.allowedRoles || [],
          });

          const mode = deriveTargetingModeFromCampaign(campaignToEdit);
          setTargetingMode(mode);
          setSelectedEmployeeIds(mode === 'employees' ? campaignToEdit.allowedEmployeeIds || [] : []);
          setEditingCampaignId(campaignToEdit.id);
          setWizardStep(1);
          setActiveTab('create');
          setShowCreateWizard(true);
        }

        // Clear the edit param from URL
        searchParams.delete('edit');
        setSearchParams(searchParams);
      } catch (error) {
        console.error('Failed to load campaign for editing:', error);
        setCampaignError('Failed to load campaign for editing.');
      } finally {
        setLoadingEditCampaign(false);
      }
    };

    loadCampaignForEdit();
  }, [searchParams, campaigns, setSearchParams, setActiveTab, mapCampaignDocToUI]);

  // Toggle pin status for a campaign (optimistic update)
  const togglePinCampaign = useCallback(async (campaignId: string, currentPinned: boolean) => {
    // Optimistic update - update local state immediately
    setCampaigns(prev => prev.map(c =>
      c.id === campaignId ? { ...c, pinned: !currentPinned } : c
    ));

    try {
      await updateCampaign(campaignId, { pinned: !currentPinned });
    } catch (error) {
      // Revert on error
      setCampaigns(prev => prev.map(c =>
        c.id === campaignId ? { ...c, pinned: currentPinned } : c
      ));
      console.error('Failed to toggle pin status:', error);
      setCampaignError('Failed to update pin status. Please try again.');
    }
  }, []);

  // Open enrollment modal for DiCode campaigns
  const handleOpenEnrollmentModal = useCallback((campaign: Campaign) => {
    setEnrollmentModalCampaign(campaign);
    setEnrollmentSelectedEmployees([]);
    setEnrollmentSelectedDepartments([]);
    setEnrollmentSelectedCohorts([]);
    setEnrollmentSearchQuery('');
    setEnrollmentPage(0);
  }, []);

  // Close enrollment modal
  const handleCloseEnrollmentModal = useCallback(() => {
    setEnrollmentModalCampaign(null);
    setEnrollmentSelectedEmployees([]);
    setEnrollmentSelectedDepartments([]);
    setEnrollmentSelectedCohorts([]);
    setEnrollmentSearchQuery('');
  }, []);

  // Filter employees for enrollment modal
  const filteredEnrollmentEmployees = useMemo(() => {
    let filtered = availableEmployees.filter(emp => emp.role !== 'admin');

    // Apply search
    if (enrollmentSearchQuery) {
      const query = enrollmentSearchQuery.toLowerCase();
      filtered = filtered.filter(emp =>
        emp.name.toLowerCase().includes(query) ||
        emp.email.toLowerCase().includes(query) ||
        emp.department?.toLowerCase().includes(query)
      );
    }

    // Apply department filter
    if (enrollmentSelectedDepartments.length > 0) {
      filtered = filtered.filter(emp =>
        emp.department && enrollmentSelectedDepartments.includes(emp.department)
      );
    }

    // Apply cohort filter
    if (enrollmentSelectedCohorts.length > 0) {
      filtered = filtered.filter(emp =>
        emp.cohortIds?.some(id => enrollmentSelectedCohorts.includes(id))
      );
    }

    return filtered;
  }, [availableEmployees, enrollmentSearchQuery, enrollmentSelectedDepartments, enrollmentSelectedCohorts]);

  // Paginated enrollment employees
  const paginatedEnrollmentEmployees = useMemo(() => {
    const start = enrollmentPage * ENROLLMENT_PER_PAGE;
    return filteredEnrollmentEmployees.slice(start, start + ENROLLMENT_PER_PAGE);
  }, [filteredEnrollmentEmployees, enrollmentPage]);

  const totalEnrollmentPages = Math.ceil(filteredEnrollmentEmployees.length / ENROLLMENT_PER_PAGE);

  // Handle bulk enrollment
  const handleBulkEnroll = useCallback(async () => {
    if (!enrollmentModalCampaign || !user?.organization) return;

    const employeesToEnroll = enrollmentSelectedEmployees.length > 0
      ? enrollmentSelectedEmployees
      : filteredEnrollmentEmployees.map(e => e.id);

    if (employeesToEnroll.length === 0) {
      setCampaignError('No employees selected for enrollment');
      return;
    }

    setIsEnrolling(true);
    const orgId = user.organization || '';
    console.log('📝 Enrolling users in campaign:', enrollmentModalCampaign.id, 'with orgId:', orgId);

    try {
      await Promise.all(
        employeesToEnroll.map(employeeId =>
          enrollUserInCampaign(
            enrollmentModalCampaign.id,
            employeeId,
            orgId,
            user.id,
            false
          )
        )
      );

      console.log('✅ Enrollment complete, refreshing counts...');

      // Small delay to ensure Firestore has committed the writes
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh enrollment counts and wait for completion
      await loadEnrollmentCounts(campaigns);
      handleCloseEnrollmentModal();
    } catch (error) {
      console.error('Failed to enroll users:', error);
      setCampaignError('Failed to enroll some users. Please try again.');
    } finally {
      setIsEnrolling(false);
    }
  }, [enrollmentModalCampaign, user?.organization, user?.id, enrollmentSelectedEmployees, filteredEnrollmentEmployees, campaigns, loadEnrollmentCounts, handleCloseEnrollmentModal]);

  // Toggle employee selection in enrollment modal
  const toggleEnrollmentEmployee = useCallback((employeeId: string) => {
    setEnrollmentSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  }, []);

  // Select all visible employees
  const selectAllEnrollmentEmployees = useCallback(() => {
    const visibleIds = paginatedEnrollmentEmployees.map(e => e.id);
    const allSelected = visibleIds.every(id => enrollmentSelectedEmployees.includes(id));

    if (allSelected) {
      setEnrollmentSelectedEmployees(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setEnrollmentSelectedEmployees(prev => [...new Set([...prev, ...visibleIds])]);
    }
  }, [paginatedEnrollmentEmployees, enrollmentSelectedEmployees]);

  // Load cohorts for targeting
  useEffect(() => {
    if (user?.organization) {
      getCohortsByOrganization(user.organization)
        .then((cohorts) => {
          setAvailableCohorts(
            cohorts.map((c) => ({
              id: c.id,
              name: c.name,
              description: c.description || undefined,
              employeeIds: c.employeeIds,
              createdAt: c.createdAt,
            }))
          );
        })
        .catch((err) => console.error('Failed to load cohorts:', err));
    }
  }, [user?.organization]);

  // Load employees for campaign participant selection
  useEffect(() => {
    if (user?.organization) {
      getUsersByOrganization(user.organization)
        .then((users) => {
          setAvailableEmployees(
            users.map((u) => ({
              id: u.id,
              email: u.email,
              name: u.name,
              department: u.department || undefined,
              cohortIds: u.cohortIds,
              createdAt: u.createdAt,
              lastLogin: u.lastLogin,
              status: u.status,
              role: u.role,
              avatar: u.avatar,
            }))
          );
        })
        .catch((err) => console.error('Failed to load employees:', err));
    }
  }, [user?.organization]);

  // Utility to get video duration from URL
  const getVideoDuration = async (videoUrl: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = videoUrl;

      video.onloadedmetadata = () => {
        resolve(Math.round(video.duration));
      };

      video.onerror = () => {
        reject(new Error('Failed to load video metadata'));
      };
    });
  };

  // Load videos for campaign selection
  useEffect(() => {
    if (showCreateWizard && !authLoading) {
      setIsLoadingVideos(true);
      getAllVideos(user?.organization)
        .then((videos) => {
          setAvailableVideos(videos);
        })
        .catch((err) => console.error('Failed to load videos:', err))
        .finally(() => setIsLoadingVideos(false));
    }
  }, [showCreateWizard, user?.organization, authLoading]);

  // Calculate missing durations as fallback
  useEffect(() => {
    const calculateMissingDurations = async () => {
      const videosNeedingDuration = availableVideos.filter(v => !v.duration || v.duration === 0);

      if (videosNeedingDuration.length === 0) return;

      console.log(`📊 Calculating duration for ${videosNeedingDuration.length} videos in campaign wizard...`);

      for (const video of videosNeedingDuration) {
        try {
          const duration = await getVideoDuration(video.storageUrl);
          setAvailableVideos(prev =>
            prev.map(v => v.id === video.id ? { ...v, duration } : v)
          );
          console.log(`✅ Duration calculated for "${video.title}": ${duration}s`);
        } catch (err) {
          console.warn(`⚠️ Failed to calculate duration for "${video.title}":`, err);
        }
      }
    };

    calculateMissingDurations();
  }, [availableVideos.length]); // Only run when videos array length changes

  // Extract all competencies/tags from available videos
  const allVideoCompetencies = useMemo(() => {
    const tags = new Set<string>();
    availableVideos.forEach(video => {
      if (video.metadata.tags) {
        video.metadata.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }, [availableVideos]);

  // Filter and sort videos for selection
  const filteredVideos = useMemo(() => {
    return availableVideos
      .filter((video) => {
        const matchesSearch =
          video.title.toLowerCase().includes(videoSearchQuery.toLowerCase()) ||
          (video.description && video.description.toLowerCase().includes(videoSearchQuery.toLowerCase())) ||
          (video.metadata.tags && video.metadata.tags.some((tag) => tag.toLowerCase().includes(videoSearchQuery.toLowerCase())));

        const matchesCompetency =
          selectedVideoCompetency === 'all' ||
          (video.metadata.tags && video.metadata.tags.includes(selectedVideoCompetency));

        const matchesSource =
          videoSourceFilter === 'all' || video.source === videoSourceFilter;

        return matchesSearch && matchesCompetency && matchesSource;
      })
      .sort((a, b) => {
        if (videoSortBy === 'date-desc') {
          const aTime = a.metadata.updatedAt ? new Date(a.metadata.updatedAt).getTime() : 0;
          const bTime = b.metadata.updatedAt ? new Date(b.metadata.updatedAt).getTime() : 0;
          return bTime - aTime;
        } else if (videoSortBy === 'date-asc') {
          const aTime = a.metadata.updatedAt ? new Date(a.metadata.updatedAt).getTime() : 0;
          const bTime = b.metadata.updatedAt ? new Date(b.metadata.updatedAt).getTime() : 0;
          return aTime - bTime;
        } else if (videoSortBy === 'title-asc') {
          return a.title.localeCompare(b.title);
        } else if (videoSortBy === 'title-desc') {
          return b.title.localeCompare(a.title);
        }
        return 0;
      });
  }, [availableVideos, videoSearchQuery, selectedVideoCompetency, videoSourceFilter, videoSortBy]);

  // Reset pagination when filters change
  useEffect(() => {
    setVideoPage(0);
  }, [videoSearchQuery, selectedVideoCompetency, videoSourceFilter, videoSortBy]);

  const totalVideoPages = Math.ceil(filteredVideos.length / VIDEOS_PER_PAGE);

  const paginatedVideos = useMemo(() => {
    const start = videoPage * VIDEOS_PER_PAGE;
    return filteredVideos.slice(start, start + VIDEOS_PER_PAGE);
  }, [filteredVideos, videoPage]);

  // Audience Selection State
  const [audiencePage, setAudiencePage] = useState(0);
  const [audienceSearchQuery, setAudienceSearchQuery] = useState('');
  const AUDIENCE_PER_PAGE = 8;
  const isSelectionMode = selectedEmployeeIds.length > 0;

  // Filter employees based on search, department, role, and cohort
  const filteredAudience = useMemo(() => {
    return availableEmployees.filter(employee => {
      // 1. Search (Name/Email/Dept)
      if (audienceSearchQuery) {
        const query = audienceSearchQuery.toLowerCase();
        const matchesSearch =
          employee.name.toLowerCase().includes(query) ||
          employee.email.toLowerCase().includes(query) ||
          (employee.department && employee.department.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // 2. Department Filter
      if (campaignForm.allowedDepartments && campaignForm.allowedDepartments.length > 0) {
        if (!employee.department || !campaignForm.allowedDepartments.includes(employee.department)) {
          return false;
        }
      }

      // 3. Role Filter
      if (campaignForm.allowedRoles && campaignForm.allowedRoles.length > 0) {
        // Simple check: is the employee's role in the allowed list?
        if (!campaignForm.allowedRoles.includes(employee.role)) {
          return false;
        }
      }

      // 4. Cohort Filter
      if (campaignForm.allowedCohortIds && campaignForm.allowedCohortIds.length > 0) {
        const userCohorts = employee.cohortIds || [];
        const hasMatchingCohort = userCohorts.some(cid => campaignForm.allowedCohortIds?.includes(cid));
        if (!hasMatchingCohort) return false;
      }

      return true;
    });
  }, [availableEmployees, audienceSearchQuery, campaignForm.allowedDepartments, campaignForm.allowedRoles, campaignForm.allowedCohortIds]);

  const totalAudiencePages = Math.ceil(filteredAudience.length / AUDIENCE_PER_PAGE);

  const paginatedAudience = useMemo(() => {
    const start = audiencePage * AUDIENCE_PER_PAGE;
    return filteredAudience.slice(start, start + AUDIENCE_PER_PAGE);
  }, [filteredAudience, audiencePage]);

  // Reset page when filters change
  useEffect(() => {
    setAudiencePage(0);
  }, [audienceSearchQuery, campaignForm.allowedDepartments, campaignForm.allowedRoles, campaignForm.allowedCohortIds]);

  const handleNextAudiencePage = () => {
    if ((audiencePage + 1) * AUDIENCE_PER_PAGE < filteredAudience.length) {
      setAudiencePage(prev => prev + 1);
    }
  };

  const handlePrevAudiencePage = () => {
    if (audiencePage > 0) {
      setAudiencePage(prev => prev - 1);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedEmployeeIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSelectAllVisible = () => {
    // If all visible are already selected, deselect them. Otherwise select them.
    const allVisibleSelected = paginatedAudience.every(m => selectedEmployeeIds.includes(m.id));

    if (allVisibleSelected) {
      // Deselect visible
      setSelectedEmployeeIds(prev => prev.filter(id => !paginatedAudience.find(m => m.id === id)));
    } else {
      // Select visible
      const newIds = new Set(selectedEmployeeIds);
      paginatedAudience.forEach(m => newIds.add(m.id));
      setSelectedEmployeeIds(Array.from(newIds));
    }
  };

  const clearSelection = () => {
    setSelectedEmployeeIds([]);
  };

  // Reset audience page when filters change
  useEffect(() => {
    setAudiencePage(0);
  }, [audienceSearchQuery, campaignForm.allowedDepartments, campaignForm.allowedRoles, campaignForm.allowedCohortIds]);

  const handleNextVideoPage = () => {
    if (videoPage < totalVideoPages - 1) {
      setVideoPage(prev => prev + 1);
    }
  };

  const handlePrevVideoPage = () => {
    if (videoPage > 0) {
      setVideoPage(prev => prev - 1);
    }
  };

  // Check if video filters are active
  const hasActiveVideoFilters = selectedVideoCompetency !== 'all' || videoSourceFilter !== 'all' || videoSortBy !== 'date-desc';

  // Clear video filters
  const clearVideoFilters = () => {
    setSelectedVideoCompetency('all');
    setVideoSourceFilter('all');
    setVideoSortBy('date-desc');
  };

  // Format duration helper
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditParticipantsModal, setShowEditParticipantsModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Separate campaigns into user org campaigns and DiCode campaigns
  const userOrgCampaigns = useMemo(() => {
    // Campaigns created by users in the current organization
    // These show in Active/Draft tabs
    return campaigns.filter(c => {
      // Explicit organization campaign
      if (c.source === 'organization') {
        return true;
      }

      // Legacy campaigns (no source field): Check if has specific allowedOrganizations
      // If it has specific orgs listed, it was likely created for that org in Client Console
      if (!c.source && c.allowedOrganizations && c.allowedOrganizations.length > 0) {
        // Check if user's org is in the list
        return !user?.organization || c.allowedOrganizations.includes(user.organization);
      }

      return false;
    });
  }, [campaigns, user?.organization]);

  const dicodeCampaigns = useMemo(() => {
    // Campaigns created by DiCode team (in Workspace) accessible to this organization
    // These show in DiCode tab
    return campaigns.filter(c => {
      // Explicit DiCode campaign
      if (c.source === 'dicode') {
        // Check if this organization has access
        if (!c.allowedOrganizations || c.allowedOrganizations.length === 0) {
          return true; // Accessible to all
        }
        // Check if user's organization is in allowed list
        return user?.organization && c.allowedOrganizations.includes(user.organization);
      }

      // Legacy campaigns (no source field): If no specific allowedOrganizations, treat as DiCode
      if (!c.source && (!c.allowedOrganizations || c.allowedOrganizations.length === 0)) {
        return true; // Accessible to all organizations
      }

      return false;
    });
  }, [campaigns, user?.organization]);

  // Filter DICode campaigns based on search
  const filteredDICodeCampaigns = dicodeCampaigns.filter((campaign) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      campaign.name.toLowerCase().includes(searchLower) ||
      campaign.description.toLowerCase().includes(searchLower) ||
      campaign.purpose?.toLowerCase().includes(searchLower) ||
      campaign.targetCompetencies?.some((c: string) => c.toLowerCase().includes(searchLower))
    );
  });

  // Pinned active campaigns
  const pinnedCampaigns = useMemo(() => {
    const allActiveCampaigns = [...userOrgCampaigns, ...dicodeCampaigns].filter(c => c.status === 'active');
    return allActiveCampaigns.filter(c => c.pinned);
  }, [userOrgCampaigns, dicodeCampaigns]);

  // Competencies
  const competencies = COMPETENCIES;


  // Filter campaigns
  // Filter campaigns based on active tab
  const filteredCampaigns = useMemo(() => {
    // Active tab: show both user org AND DiCode campaigns
    // Draft tab: show only user org campaigns (DiCode campaigns aren't drafts for clients)
    // Completed tab: show both user org AND DiCode campaigns
    const baseCampaigns = activeTab === 'active' || activeTab === 'completed'
      ? [...userOrgCampaigns, ...dicodeCampaigns]
      : userOrgCampaigns;

    return baseCampaigns.filter((campaign) => {
      const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === 'active' ? campaign.status === 'active' :
        activeTab === 'draft' ? campaign.status === 'draft' :
          activeTab === 'completed' ? campaign.status === 'completed' : true;
      return matchesSearch && matchesTab;
    });
  }, [activeTab, userOrgCampaigns, dicodeCampaigns, searchQuery]);

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500';
      case 'draft':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'completed':
        return 'bg-blue-500/10 text-blue-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  // Handle create campaign - show template selection
  const handleCreateCampaign = () => {
    setActiveTab('create');
    setShowCreateWizard(false);
    setWizardStep(1);
    setCompetencyValidationError('');
    setEmployeeSearchTerm('');
    setSelectedEmployeeIds([]);
    setEmployeeDepartmentFilter('all');
    setEmployeeRoleFilter('all');
    setEmployeeRegionFilter('all');
    setEmployeeCohortFilter('all');
    setTargetingMode('all');
    setCampaignForm({
      name: '',
      description: '',
      targetCompetencies: [],
      frequency: 'monthly',
      campaignType: null,
      participants: [],
      anonymousResponses: false,
      cohortGroup: '',
      startDate: '',
      endDate: '',
      oneTimeAccess: false,
      autoSendInvites: true,
      sendReminders: true,
      sendConfirmations: true,
      selectedCompetency: null,
      selectedSkills: {},
      customContent: [],
      allowedDepartments: [],
      allowedEmployeeIds: [],
      allowedCohortIds: [],
      allowedRoles: [],
    });
  };

  // Handle template selection - start wizard with template and prefill form
  const handleTemplateSelect = (templateId: string) => {
    const template = campaignTypes.find(t => t.id === templateId);
    if (template) {
      // Try to map template skills to actual competencies
      const matchedCompetencies: string[] = [];
      const matchedSkills: Record<string, string[]> = {};

      template.skills.forEach(templateSkill => {
        // Try to find a matching competency by checking if any competency name or skill name contains the template skill name
        for (const comp of competencies) {
          // Check if competency name matches
          if (comp.name.toLowerCase().includes(templateSkill.name.toLowerCase()) ||
            templateSkill.name.toLowerCase().includes(comp.name.toLowerCase())) {
            if (!matchedCompetencies.includes(comp.name)) {
              matchedCompetencies.push(comp.name);
              // Pre-select first skill from this competency
              if (comp.skills.length > 0) {
                matchedSkills[comp.id] = [comp.skills[0].id];
              }
            }
            break;
          }
          // Check if any skill in the competency matches
          const matchingSkill = comp.skills.find(s =>
            s.name.toLowerCase().includes(templateSkill.name.toLowerCase()) ||
            templateSkill.name.toLowerCase().includes(s.name.toLowerCase())
          );
          if (matchingSkill) {
            if (!matchedCompetencies.includes(comp.name)) {
              matchedCompetencies.push(comp.name);
              matchedSkills[comp.id] = [matchingSkill.id];
            } else if (!matchedSkills[comp.id]?.includes(matchingSkill.id)) {
              matchedSkills[comp.id] = [...(matchedSkills[comp.id] || []), matchingSkill.id];
            }
            break;
          }
        }
      });

      // Generate a default name with date
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const defaultName = `${template.name} - ${dateStr}`;
      const defaultDescription = template.description;

      setCampaignForm(prev => ({
        ...prev,
        name: defaultName,
        description: defaultDescription,
        campaignType: template.id,
        targetCompetencies: matchedCompetencies,
        selectedSkills: matchedSkills,
      }));
    }
    setShowCreateWizard(true);
    setWizardStep(1);
  };

  // Handle wizard navigation
  const handleNextStep = () => {
    // Validate Step 1: Basics (Name, Description, Competencies)
    if (wizardStep === 1) {
      if (!campaignForm.name || !campaignForm.description) {
        setCampaignError('Please provide a campaign name and description');
        return;
      }

      // Check if at least 3-5 competencies are selected
      if (campaignForm.targetCompetencies.length < 3 || campaignForm.targetCompetencies.length > 5) {
        setCompetencyValidationError('Please select between 3 and 5 competencies');
        return;
      }

      // Check if at least one skill is selected for each selected competency
      const competenciesWithoutSkills: string[] = [];
      campaignForm.targetCompetencies.forEach((compName) => {
        const comp = competencies.find(c => c.name === compName);
        if (comp) {
          const selectedSkillsForComp = campaignForm.selectedSkills[comp.id] || [];
          if (selectedSkillsForComp.length === 0) {
            competenciesWithoutSkills.push(compName);
          }
        }
      });

      if (competenciesWithoutSkills.length > 0) {
        setCompetencyValidationError(`Please select at least one skill for: ${competenciesWithoutSkills.join(', ')}`);
        return;
      }

      setCompetencyValidationError('');
      setCampaignError(null);
    }

    // Validate Step 2: Videos
    if (wizardStep === 2) {
      // Optional: Add video validation here if needed
      setCampaignError(null);
    }

    // Handle Step 3: Audience (Sync explicit selection)
    if (wizardStep === 3) {
      if (selectedEmployeeIds.length > 0) {
        // Explicit Mode: User selected specific people.
        // We clear broad filters to ensure backend targets ONLY these specific users (since backend uses OR logic).
        setCampaignForm(prev => ({
          ...prev,
          allowedEmployeeIds: [...selectedEmployeeIds],
          allowedDepartments: [],
          allowedRoles: [],
          allowedCohortIds: [],
          // Update participants list for UI/Summary if needed
          participants: buildParticipantsFromIds(selectedEmployeeIds)
        }));
      } else {
        // Implicit Mode: User relies on filters. Clear explicit IDs.
        setCampaignForm(prev => ({
          ...prev,
          allowedEmployeeIds: [],
          participants: [] // Or should we populate this with ALL matching users? 
          // Usually 'participants' field in DB is for explicit overrides or tracking.
          // The backend calculates enrollment based on rules.
          // So leaving it empty is correct for Rule-Based targeting.
        }));
      }
    }

    if (wizardStep < 4) {
      setWizardStep(wizardStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1);
    }
  };

  // Handle save campaign
  const handleSaveCampaign = async ({ publish = false }: { publish?: boolean } = {}) => {
    if (!campaignForm.name || !campaignForm.description || !user?.id) return;

    setIsSavingCampaign(true);
    setCampaignError(null);
    try {
      const skillFocus =
        campaignForm.targetCompetencies[0] ||
        campaignForm.description ||
        'Leadership';

      // Determine if we're editing or creating
      const isEditing = editingCampaignId !== null;
      const campaignId = isEditing
        ? editingCampaignId
        : await createCampaignDoc(user.id, {
          title: campaignForm.name,
          description: campaignForm.description,
          skillFocus,
          tags: campaignForm.targetCompetencies,
          userOrganization: user.organization,
        });

      // Convert participants to employee IDs for filtering
      const isEmployeeTargeting = targetingMode === 'employees';
      const participantIds = isEmployeeTargeting ? campaignForm.participants.map(p => p.id) : [];
      const allEmployeeIds = isEmployeeTargeting
        ? [
          ...participantIds,
          ...(campaignForm.allowedEmployeeIds || []),
        ]
        : [];
      const uniqueEmployeeIds = Array.from(new Set(allEmployeeIds));
      const departmentTargets = targetingMode === 'departments' ? campaignForm.allowedDepartments : [];
      const cohortTargets = targetingMode === 'cohorts' ? campaignForm.allowedCohortIds : [];

      // Update campaign with targeting fields, scheduling, and automation
      await updateCampaign(campaignId, {
        // Include basic fields when editing
        ...(isEditing ? {
          title: campaignForm.name,
          description: campaignForm.description,
          skillFocus,
        } : {}),
        campaignType: campaignForm.campaignType || undefined,
        anonymousResponses: campaignForm.anonymousResponses,
        allowedDepartments: departmentTargets.length > 0
          ? departmentTargets
          : undefined,
        allowedEmployeeIds: uniqueEmployeeIds.length > 0
          ? uniqueEmployeeIds
          : undefined,
        allowedCohortIds: cohortTargets.length > 0
          ? cohortTargets
          : undefined,
        schedule: {
          startDate: campaignForm.startDate || undefined,
          endDate: campaignForm.endDate || undefined,
          frequency: campaignForm.frequency,
        },
        accessControl: {
          oneTimeAccess: campaignForm.oneTimeAccess,
          maxAccessCount: campaignForm.oneTimeAccess ? 1 : undefined,
        },
        automation: {
          autoSendInvites: campaignForm.autoSendInvites,
          sendReminders: campaignForm.sendReminders,
          reminderFrequency: 3, // Default to 3 days
          maxReminders: 3, // Default to 3 reminders
          sendConfirmations: campaignForm.sendConfirmations,
        },
        stats: {
          totalEnrollments: 0,
          completedCount: 0,
          inProgressCount: 0,
          notStartedCount: 0,
        },
      });

      // Create campaign items for selected videos (only if not editing, or if videos changed)
      // TODO: For edit mode, you may want to compare with existing items and only update if changed
      if (!isEditing || selectedVideoIds.length > 0) {
        for (let i = 0; i < selectedVideoIds.length; i++) {
          await createCampaignItem(
            campaignId,
            selectedVideoIds[i],
            i,
            [] // Questions can be added later
          );
        }
      }

      if (publish) {
        await setCampaignPublishState(campaignId, true);
      }

      await refreshCampaigns();
      setShowCreateWizard(false);
      setEditingCampaignId(null); // Reset editing state
      setActiveTab(publish ? 'active' : 'draft');
      setWizardStep(1);
    } catch (error) {
      console.error('Failed to save campaign', error);
      setCampaignError('Failed to save campaign. Please try again.');
    } finally {
      setIsSavingCampaign(false);
    }
  };

  // Handle launch campaign
  const handleLaunchCampaign = async () => {
    await handleSaveCampaign({ publish: true });
  };

  const handleCampaignStatusChange = async (campaignId: string, publish: boolean) => {
    setCampaignError(null);
    const newStatus = publish ? 'active' : 'draft';

    // Optimistic update - update local state immediately
    setCampaigns(prev => prev.map(c =>
      c.id === campaignId ? { ...c, status: newStatus as 'active' | 'draft' | 'completed' } : c
    ));

    try {
      await setCampaignPublishState(campaignId, publish);
    } catch (error) {
      // Revert on error
      const revertStatus = publish ? 'draft' : 'active';
      setCampaigns(prev => prev.map(c =>
        c.id === campaignId ? { ...c, status: revertStatus as 'active' | 'draft' | 'completed' } : c
      ));
      console.error('Failed to update campaign status', error);
      setCampaignError('Failed to update campaign status. Please try again.');
    }
  };

  const handleDuplicateCampaign = async (campaign: Campaign) => {
    if (!user?.id) return;
    setCampaignError(null);
    try {
      await createCampaignDoc(user.id, {
        title: `${campaign.name} (Copy)`,
        description: campaign.description,
        skillFocus: campaign.purpose || campaign.description,
        tags: campaign.targetCompetencies,
        userOrganization: user.organization,
      });
      await refreshCampaigns();
    } catch (error) {
      console.error('Failed to duplicate campaign', error);
      setCampaignError('Failed to duplicate campaign.');
    }
  };

  const handleEditCampaign = (campaign: Campaign) => {
    if (!user?.id) return;

    // Populate form with existing campaign data
    setCampaignForm({
      name: campaign.name,
      description: campaign.description,
      targetCompetencies: campaign.targetCompetencies || [],
      frequency: campaign.frequency,
      campaignType: campaign.campaignType || null,
      participants: campaign.participants || [],
      anonymousResponses: campaign.anonymousResponses,
      cohortGroup: campaign.cohortGroup || '',
      startDate: campaign.startDate ? new Date(campaign.startDate).toISOString().split('T')[0] : '',
      endDate: campaign.endDate ? new Date(campaign.endDate).toISOString().split('T')[0] : '',
      oneTimeAccess: campaign.oneTimeAccess,
      autoSendInvites: campaign.autoSendInvites,
      sendReminders: campaign.sendReminders,
      sendConfirmations: campaign.sendConfirmations,
      selectedCompetency: null,
      selectedSkills: campaign.selectedSkills || {},
      customContent: [],
      allowedDepartments: campaign.allowedDepartments || [],
      allowedEmployeeIds: campaign.allowedEmployeeIds || [],
      allowedCohortIds: campaign.allowedCohortIds || [],
      allowedRoles: campaign.allowedRoles || [],
    });

    const mode = deriveTargetingModeFromCampaign(campaign);
    setTargetingMode(mode);
    setSelectedEmployeeIds(mode === 'employees' ? campaign.allowedEmployeeIds || [] : []);

    // Set the editing campaign ID
    setEditingCampaignId(campaign.id);

    // Set wizard step to 1 and show the wizard
    setWizardStep(1);
    setActiveTab('create');
    setShowCreateWizard(true);
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    setCampaignError(null);
    setIsDeleting(true);

    // Store campaign for potential revert
    const deletedCampaign = campaigns.find(c => c.id === campaignId);

    // Optimistic update - remove from local state immediately
    setCampaigns(prev => prev.filter(c => c.id !== campaignId));

    try {
      await deleteCampaignDoc(campaignId);
    } catch (error) {
      // Revert on error - add campaign back
      if (deletedCampaign) {
        setCampaigns(prev => [...prev, deletedCampaign]);
      }
      console.error('Failed to delete campaign', error);
      setCampaignError('Failed to delete campaign.');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  // Render DICode campaign card (matches regular campaign card design)
  const renderDICodeCampaignCard = (campaign: Campaign) => {
    const enrolledCount = enrollmentCounts[campaign.id] ?? 0;
    const completionRate = completionRates[campaign.id] ?? 0;

    return (
      <div
        key={campaign.id}
        onClick={() => navigate(`/admin/campaigns/${campaign.id}`)}
        className="group relative rounded-xl border border-dark-border/50 bg-dark-card transition-all duration-200 hover:border-white/20 hover:bg-white/5 hover:shadow-lg hover:shadow-white/5 cursor-pointer"
      >
        <div className="p-3.5">
          {/* Header: Title + Badge + Actions */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-medium text-dark-text truncate">{campaign.name}</h3>
                {campaign.pinned && (
                  <Pin size={10} className="text-primary fill-primary flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-dark-text-muted/70 line-clamp-1 mt-0.5">{campaign.description}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-400">
                <Megaphone size={8} />
                DiCode
              </span>
              {/* 3-dot menu */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setOpenMenuId(openMenuId === campaign.id ? null : campaign.id)}
                  className="p-1.5 rounded-lg text-dark-text-muted hover:text-dark-text hover:bg-white/10 transition-colors"
                >
                  <MoreVertical size={14} />
                </button>
                {openMenuId === campaign.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-dark-border bg-dark-card shadow-xl py-1">
                      <button
                        onClick={() => { togglePinCampaign(campaign.id, campaign.pinned || false); setOpenMenuId(null); }}
                        className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-white/5 transition-colors flex items-center gap-2"
                      >
                        <Pin size={14} className={campaign.pinned ? 'fill-current' : ''} />
                        {campaign.pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        onClick={() => { handleDuplicateCampaign(campaign); setOpenMenuId(null); }}
                        className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-white/5 transition-colors flex items-center gap-2"
                      >
                        <Copy size={14} /> Duplicate
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 text-[11px] text-dark-text-muted pt-2 border-t border-dark-border/30">
            <span className="inline-flex items-center gap-1">
              <Users size={11} className="opacity-50" />
              <span className="font-medium text-dark-text">{enrolledCount}</span>
            </span>
            <div className="flex items-center gap-2 flex-1 max-w-[120px]">
              <Target size={11} className="opacity-50 flex-shrink-0" />
              <div className="flex-1 h-1.5 rounded-full bg-dark-bg overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    completionRate >= 80 ? 'bg-emerald-400' : completionRate >= 50 ? 'bg-amber-400' : 'bg-white/30'
                  }`}
                  style={{ width: `${Math.min(completionRate, 100)}%` }}
                />
              </div>
              <span className="font-medium text-dark-text text-[10px] w-7 text-right">{completionRate}%</span>
            </div>
            <span className="inline-flex items-center gap-1 ml-auto">
              <Calendar size={11} className="opacity-50" />
              {formatDate(campaign.startDate)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Render campaign card
  const renderCampaignCard = (campaign: Campaign) => {
    const enrolledCount = enrollmentCounts[campaign.id] ?? 0;
    const completionRate = completionRates[campaign.id] ?? 0;

    const statusConfig = {
      active: { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
      draft: { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-400/10' },
      completed: { dot: 'bg-slate-400', text: 'text-slate-400', bg: 'bg-slate-400/10' },
    };
    const config = statusConfig[campaign.status] || statusConfig.draft;

    return (
      <div
        key={campaign.id}
        onClick={() => navigate(`/admin/campaigns/${campaign.id}`)}
        className="group relative rounded-xl border border-dark-border/50 bg-dark-card transition-all duration-200 hover:border-white/20 hover:bg-white/5 hover:shadow-lg hover:shadow-white/5 cursor-pointer"
      >
        <div className="p-3.5">
          {/* Header: Title + Status + Actions */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-medium text-dark-text truncate">{campaign.name}</h3>
                {campaign.pinned && (
                  <Pin size={10} className="text-primary fill-primary flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-dark-text-muted/70 line-clamp-1 mt-0.5">{campaign.description}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {campaign.source === 'dicode' && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-violet-300 border border-violet-500/30">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  DiCode
                </span>
              )}
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bg} ${config.text}`}>
                <span className={`w-1 h-1 rounded-full ${config.dot}`} />
                {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
              </span>
              {/* 3-dot menu */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setOpenMenuId(openMenuId === campaign.id ? null : campaign.id)}
                  className="p-1.5 rounded-lg text-dark-text-muted hover:text-dark-text hover:bg-white/10 transition-colors"
                >
                  <MoreVertical size={14} />
                </button>
                {openMenuId === campaign.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-dark-border bg-dark-card shadow-xl py-1">
                      {campaign.source !== 'dicode' && campaign.status === 'draft' && (
                        <>
                          <button
                            onClick={() => { handleEditCampaign(campaign); setOpenMenuId(null); }}
                            className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-white/5 transition-colors flex items-center gap-2"
                          >
                            <Edit size={14} /> Edit
                          </button>
                          <button
                            onClick={() => { handleCampaignStatusChange(campaign.id, true); setOpenMenuId(null); }}
                            className="w-full px-3 py-2 text-left text-sm text-emerald-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                          >
                            <Play size={14} /> Launch
                          </button>
                        </>
                      )}
                      {campaign.source !== 'dicode' && campaign.status === 'active' && (
                        <>
                          <button
                            onClick={() => { togglePinCampaign(campaign.id, campaign.pinned || false); setOpenMenuId(null); }}
                            className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-white/5 transition-colors flex items-center gap-2"
                          >
                            <Pin size={14} className={campaign.pinned ? 'fill-current' : ''} />
                            {campaign.pinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button
                            onClick={() => { handleCampaignStatusChange(campaign.id, false); setOpenMenuId(null); }}
                            className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-white/5 transition-colors flex items-center gap-2"
                          >
                            <Pause size={14} /> Pause
                          </button>
                        </>
                      )}
                      {campaign.status === 'active' && campaign.source === 'dicode' && (
                        <>
                          <button
                            onClick={() => { togglePinCampaign(campaign.id, campaign.pinned || false); setOpenMenuId(null); }}
                            className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-white/5 transition-colors flex items-center gap-2"
                          >
                            <Pin size={14} className={campaign.pinned ? 'fill-current' : ''} />
                            {campaign.pinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button
                            onClick={() => { handleOpenEnrollmentModal(campaign); setOpenMenuId(null); }}
                            className="w-full px-3 py-2 text-left text-sm text-emerald-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                          >
                            <Users size={14} /> Manage Enrollments
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => { handleDuplicateCampaign(campaign); setOpenMenuId(null); }}
                        className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-white/5 transition-colors flex items-center gap-2"
                      >
                        <Copy size={14} /> Duplicate
                      </button>
                      {campaign.source !== 'dicode' && (
                        <button
                          onClick={() => { setDeleteConfirmId(campaign.id); setOpenMenuId(null); }}
                          className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 text-[11px] text-dark-text-muted pt-2 border-t border-dark-border/30">
            <span className="inline-flex items-center gap-1">
              <Users size={11} className="opacity-50" />
              <span className="font-medium text-dark-text">{enrolledCount}</span>
            </span>
            <div className="flex items-center gap-2 flex-1 max-w-[120px]">
              <Target size={11} className="opacity-50 flex-shrink-0" />
              <div className="flex-1 h-1.5 rounded-full bg-dark-bg overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    completionRate >= 80 ? 'bg-emerald-400' : completionRate >= 50 ? 'bg-amber-400' : 'bg-white/30'
                  }`}
                  style={{ width: `${Math.min(completionRate, 100)}%` }}
                />
              </div>
              <span className="font-medium text-dark-text text-[10px] w-7 text-right">{completionRate}%</span>
            </div>
            <span className="inline-flex items-center gap-1 ml-auto">
              <Calendar size={11} className="opacity-50" />
              {formatDate(campaign.startDate)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Render campaigns as a list/table view
  const renderCampaignsList = (campaignsList: Campaign[], isDiCode: boolean = false) => {
    if (campaignsList.length === 0) return null;

    return (
      <div className="rounded-xl border border-dark-border bg-dark-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-border bg-dark-bg">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-text-muted">
                Campaign
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-text-muted">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-text-muted">
                Schedule
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-text-muted">
                Participants
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-text-muted">
                Completion
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-dark-text-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {campaignsList.map((campaign) => {
              const enrollmentSummary = getEnrollmentSummary(campaign);
              return (
                <tr
                  key={campaign.id}
                  onClick={() => navigate(`/admin/campaigns/${campaign.id}`)}
                  className="group hover:bg-white/5 transition-all cursor-pointer border-l-2 border-l-transparent hover:border-l-primary/50"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dark-bg text-dark-text-muted">
                        <Megaphone size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-dark-text truncate max-w-[200px]">{campaign.name}</p>
                          {campaign.pinned && (
                            <Pin size={12} className="text-primary fill-primary" />
                          )}
                          {isDiCode && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-violet-300 border border-violet-500/30">
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              DiCode
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-dark-text-muted truncate max-w-[250px]">{campaign.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(campaign.status)}`}>
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-dark-text">
                      {formatDate(campaign.startDate)}
                    </div>
                    <div className="text-xs text-dark-text-muted">
                      to {formatDate(campaign.endDate)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-dark-text">
                      <Users size={14} className="text-dark-text-muted" />
                      {enrollmentSummary}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-dark-bg max-w-[60px]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (completionRates[campaign.id] ?? 0) >= 80 ? 'bg-emerald-400'
                              : (completionRates[campaign.id] ?? 0) >= 50 ? 'bg-amber-400'
                              : 'bg-white/30'
                          }`}
                          style={{ width: `${Math.min(completionRates[campaign.id] ?? 0, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-dark-text font-medium">{completionRates[campaign.id] ?? 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end">
                      {/* 3-dot menu */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === `list-${campaign.id}` ? null : `list-${campaign.id}`)}
                          className="p-1.5 rounded-lg text-dark-text-muted hover:text-dark-text hover:bg-white/10 transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === `list-${campaign.id}` && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-dark-border bg-dark-card shadow-xl py-1">
                              {campaign.source !== 'dicode' && campaign.status === 'draft' && (
                                <>
                                  <button
                                    onClick={() => { handleEditCampaign(campaign); setOpenMenuId(null); }}
                                    className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-white/5 transition-colors flex items-center gap-2"
                                  >
                                    <Edit size={14} /> Edit
                                  </button>
                                  <button
                                    onClick={() => { handleCampaignStatusChange(campaign.id, true); setOpenMenuId(null); }}
                                    className="w-full px-3 py-2 text-left text-sm text-emerald-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                                  >
                                    <Play size={14} /> Launch
                                  </button>
                                </>
                              )}
                              {campaign.source !== 'dicode' && campaign.status === 'active' && (
                                <>
                                  <button
                                    onClick={() => { togglePinCampaign(campaign.id, campaign.pinned || false); setOpenMenuId(null); }}
                                    className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-white/5 transition-colors flex items-center gap-2"
                                  >
                                    <Pin size={14} className={campaign.pinned ? 'fill-current' : ''} />
                                    {campaign.pinned ? 'Unpin' : 'Pin'}
                                  </button>
                                  <button
                                    onClick={() => { handleCampaignStatusChange(campaign.id, false); setOpenMenuId(null); }}
                                    className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-white/5 transition-colors flex items-center gap-2"
                                  >
                                    <Pause size={14} /> Pause
                                  </button>
                                </>
                              )}
                              {campaign.status === 'active' && campaign.source === 'dicode' && (
                                <>
                                  <button
                                    onClick={() => { togglePinCampaign(campaign.id, campaign.pinned || false); setOpenMenuId(null); }}
                                    className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-white/5 transition-colors flex items-center gap-2"
                                  >
                                    <Pin size={14} className={campaign.pinned ? 'fill-current' : ''} />
                                    {campaign.pinned ? 'Unpin' : 'Pin'}
                                  </button>
                                  <button
                                    onClick={() => { handleOpenEnrollmentModal(campaign); setOpenMenuId(null); }}
                                    className="w-full px-3 py-2 text-left text-sm text-emerald-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                                  >
                                    <Users size={14} /> Manage Enrollments
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => { handleDuplicateCampaign(campaign); setOpenMenuId(null); }}
                                className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-white/5 transition-colors flex items-center gap-2"
                              >
                                <Copy size={14} /> Duplicate
                              </button>
                              {campaign.source !== 'dicode' && (
                                <button
                                  onClick={() => { setDeleteConfirmId(campaign.id); setOpenMenuId(null); }}
                                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                                >
                                  <Trash2 size={14} /> Delete
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const getTabCount = (tab: typeof activeTab) => {
    if (tab === 'dicode') {
      return filteredDICodeCampaigns.length;
    }
    if (tab === 'active' || tab === 'completed') {
      return [...userOrgCampaigns, ...dicodeCampaigns].filter((c) => c.status === tab).length;
    }
    if (tab === 'draft') {
      return userOrgCampaigns.filter((c) => c.status === tab).length;
    }
    return 0;
  };

  const TAB_CONFIG: Record<typeof activeTab, { label: string; icon: React.ElementType }> = {
    active: { label: 'Active Campaigns', icon: PlayCircle },
    draft: { label: 'Draft Campaigns', icon: FileText },
    completed: { label: 'Completed Campaigns', icon: CheckCircle },
    dicode: { label: 'DiCode Campaigns', icon: Megaphone },
    create: { label: 'Create Campaign', icon: Plus },
  };

  // Render wizard in full-screen mode (without campaign manager UI)
  // Render wizard in full-screen mode (without campaign manager UI)
  if (activeTab === 'create' && showCreateWizard) {
    const WIZARD_STEPS = [
      { id: 1, label: 'Basics', icon: FileText },
      { id: 2, label: 'Content', icon: VideoIcon },
      { id: 3, label: 'Audience', icon: Users },
      { id: 4, label: 'Schedule', icon: Calendar },
    ];

    return (
      <div className="text-white p-6 md:p-10 min-h-[calc(100vh-140px)] flex flex-col">
        <div className="max-w-screen-2xl mx-auto flex-1 flex flex-col w-full">
          <div className="flex flex-col lg:flex-row gap-12 flex-1">

            {/* Sidebar Navigation */}
            <aside className="w-full lg:w-64 flex-shrink-0 space-y-8 lg:sticky lg:top-0 h-fit">
              <div>
                <button
                  onClick={() => {
                    setShowCreateWizard(false);
                    setEditingCampaignId(null);
                    setActiveTab('active');
                  }}
                  className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-6 text-sm font-medium"
                >
                  <ArrowLeft size={16} />
                  Back to Campaigns
                </button>

                <p className="text-xs font-semibold uppercase tracking-wide text-white/50 px-3 mb-3">
                  {editingCampaignId ? 'Edit Campaign' : 'New Campaign'}
                </p>

                <div className="space-y-1">
                  {WIZARD_STEPS.map((step) => {
                    const isActive = wizardStep === step.id;
                    const isCompleted = wizardStep > step.id;
                    const Icon = step.icon;
                    return (
                      <button
                        key={step.id}
                        onClick={() => {
                          // Allow jumping back, but force sequential forward
                          if (step.id < wizardStep) setWizardStep(step.id);
                        }}
                        disabled={step.id > wizardStep}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all ${isActive
                          ? 'bg-white/15 text-white'
                          : isCompleted
                            ? 'text-white/80 hover:text-white hover:bg-white/5'
                            : 'text-white/40 cursor-not-allowed'
                          }`}
                      >
                        <Icon size={18} className={isActive ? 'text-white' : isCompleted ? 'text-emerald-400' : 'text-white/40'} />
                        {step.label}
                        {isCompleted && <CheckCircle2 size={16} className="ml-auto text-emerald-400 fill-emerald-400/20" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* Divider (Desktop) */}
            <div className="hidden lg:block w-px bg-white/5 rounded-full self-stretch" />

            {/* Main Form Content */}
            <main className="flex-1 min-w-0 max-w-5xl flex flex-col">
              {loadingEditCampaign ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/60">Loading campaign...</p>
                  </div>
                </div>
              ) : (
              <div className="flex-1 space-y-8">

                {/* Step 1: Basics */}
                {wizardStep === 1 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold text-white mb-2">Campaign Basics</h2>
                        <p className="text-white/60">Define the core identity of your campaign.</p>
                      </div>
                      <button
                        onClick={handleNextStep}
                        className="px-6 py-2.5 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-shadow shadow-lg shadow-white/5"
                      >
                        Continue
                      </button>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-white block">Campaign Name</label>
                        <input
                          type="text"
                          value={campaignForm.name}
                          onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                          placeholder="e.g., Q2 Leadership Pulse"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/15 transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-white block">Program Summary</label>
                        <textarea
                          value={campaignForm.description}
                          onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                          placeholder="What is the goal of this campaign?"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/15 min-h-[120px] resize-none transition-all"
                        />
                      </div>

                      {/* Competencies Section (Moved to Step 1) */}
                      <div className="pt-6 border-t border-white/5">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-sm font-semibold text-white">Target Competencies</label>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${campaignForm.targetCompetencies.length >= 3 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/50'
                            }`}>
                            {campaignForm.targetCompetencies.length} selected
                          </span>
                        </div>

                        {competencyValidationError && (
                          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 mb-4 flex items-center gap-2">
                            <AlertTriangle size={16} />
                            {competencyValidationError}
                          </div>
                        )}

                        <CompetencyCardGrid
                          competencies={competencies}
                          selectedCompetencies={campaignForm.targetCompetencies}
                          selectedSkills={campaignForm.selectedSkills}
                          onUpdate={(targetCompetencies, selectedSkills) => {
                            setCampaignForm({ ...campaignForm, targetCompetencies, selectedSkills });
                            setCompetencyValidationError('');
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Video Modules */}
                {wizardStep === 2 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold text-white mb-2">Video Modules</h2>
                        <p className="text-white/60">Select the video modules for this track.</p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handlePrevStep}
                          className="px-6 py-2.5 rounded-xl border border-white/10 text-white/70 font-medium hover:bg-white/5 hover:text-white transition-colors"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleNextStep}
                          className="px-6 py-2.5 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-shadow shadow-lg shadow-white/5"
                        >
                          Continue
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Video Selection Section */}
                      <div>
                        {/* Search & Filters Row */}
                        <div className="flex items-center justify-between gap-4 mb-4">
                          {/* Search */}
                          <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                            <input
                              type="text"
                              value={videoSearchQuery}
                              onChange={(e) => setVideoSearchQuery(e.target.value)}
                              placeholder="Search videos by title or tags..."
                              className="w-full h-10 rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:bg-white/10 transition-all"
                            />
                          </div>

                          {/* Filter Pills */}
                          <div className="flex items-center gap-2">
                            {/* Source Filter */}
                            <button
                              onClick={() => setVideoSourceFilter(videoSourceFilter === 'all' ? 'generated' : videoSourceFilter === 'generated' ? 'uploaded' : 'all')}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                                videoSourceFilter !== 'all'
                                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                  : 'bg-black/20 border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {videoSourceFilter === 'generated' ? (
                                <>
                                  <Sparkles size={14} />
                                  Generated
                                </>
                              ) : videoSourceFilter === 'uploaded' ? (
                                <>
                                  <Upload size={14} />
                                  Uploaded
                                </>
                              ) : (
                                <>
                                  <VideoIcon size={14} />
                                  All Sources
                                </>
                              )}
                            </button>

                            {/* Sort */}
                            <select
                              value={videoSortBy}
                              onChange={(e) => setVideoSortBy(e.target.value)}
                              className="h-9 px-3 rounded-lg border border-white/10 bg-black/20 text-xs text-white/60 focus:outline-none focus:border-white/20 cursor-pointer"
                            >
                              <option value="date-desc">Newest First</option>
                              <option value="date-asc">Oldest First</option>
                              <option value="title-asc">Title A-Z</option>
                              <option value="title-desc">Title Z-A</option>
                            </select>

                            {/* Clear Filters */}
                            {hasActiveVideoFilters && (
                              <button
                                onClick={clearVideoFilters}
                                className="text-xs text-white/50 hover:text-white transition px-2"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Selected Count */}
                        {selectedVideoIds.length > 0 && (
                          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20 mb-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                                {selectedVideoIds.length}
                              </span>
                              <span className="text-sm font-medium text-blue-200">
                                video{selectedVideoIds.length !== 1 ? 's' : ''} selected
                              </span>
                            </div>
                            <button
                              onClick={() => setSelectedVideoIds([])}
                              className="text-xs font-medium text-blue-300 hover:text-blue-200 transition-colors"
                            >
                              Clear Selection
                            </button>
                          </div>
                        )}

                        {/* Video List Wrapper */}
                        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">

                          {/* Content Area */}
                          <div>
                            {isLoadingVideos ? (
                              <div className="flex justify-center py-12">
                                <Loader2 className="animate-spin text-white/30" />
                              </div>
                            ) : filteredVideos.length === 0 ? (
                              <div className="text-center py-12">
                                <VideoIcon className="mx-auto h-8 w-8 text-white/20 mb-2" />
                                <p className="text-sm text-white/40">No videos found</p>
                              </div>
                            ) : (
                              <>
                                {/* Header Row */}
                                <div className="flex items-center gap-4 px-3 py-2 border-b border-white/5 bg-white/5 text-xs font-semibold uppercase tracking-wider text-white/40">
                                  <div className="w-20">Preview</div>
                                  <div className="flex-1">Video</div>
                                  <div className="text-right">Duration</div>
                                </div>
                                <div className="divide-y divide-white/5">
                                  {paginatedVideos.map((video) => {
                                    const isSelected = selectedVideoIds.includes(video.id);
                                    return (
                                      <button
                                        key={video.id}
                                        onClick={() => setSelectedVideoIds(prev => isSelected ? prev.filter(id => id !== video.id) : [...prev, video.id])}
                                        className={`w-full flex items-center gap-4 p-3 text-left transition-all ${isSelected
                                          ? 'bg-blue-600/10'
                                          : 'hover:bg-white/5'
                                          }`}
                                      >
                                        <div className="relative w-20 h-12 rounded-md bg-black overflow-hidden flex-shrink-0">
                                          {video.thumbnailUrl ? (
                                            <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                              <Play size={14} className="text-white/20" />
                                            </div>
                                          )}
                                          {isSelected && (
                                            <div className="absolute inset-0 bg-blue-600/40 flex items-center justify-center">
                                              <CheckCircle size={14} className="text-white" />
                                            </div>
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-400' : 'text-white'}`}>{video.title}</p>
                                        </div>
                                        <div className="text-xs text-white/40 tabular-nums font-mono">
                                          {video.duration
                                            ? `${Math.floor(video.duration / 60).toString().padStart(2, '0')}:${Math.floor(video.duration % 60).toString().padStart(2, '0')}`
                                            : '--:--'}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Pagination Controls */}
                                {totalVideoPages > 1 && (
                                  <div className="flex items-center justify-between border-t border-white/5 px-4 py-3 bg-white/5">
                                    <span className="text-xs text-white/40">
                                      Showing {videoPage * VIDEOS_PER_PAGE + 1}-{Math.min((videoPage + 1) * VIDEOS_PER_PAGE, filteredVideos.length)} of {filteredVideos.length} videos
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={handlePrevVideoPage}
                                        disabled={videoPage === 0}
                                        className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                      >
                                        <ChevronLeft className="h-4 w-4" />
                                      </button>
                                      <span className="text-xs text-white/60">
                                        Page {videoPage + 1} of {totalVideoPages}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={handleNextVideoPage}
                                        disabled={videoPage === totalVideoPages - 1}
                                        className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                      >
                                        <ChevronRight className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Audience */}
                {wizardStep === 3 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold text-white mb-2">Target Audience</h2>
                        <p className="text-white/60">Who should receive this campaign?</p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handlePrevStep}
                          className="px-6 py-2.5 rounded-xl border border-white/10 text-white/70 font-medium hover:bg-white/5 hover:text-white transition-colors"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleNextStep}
                          className="px-6 py-2.5 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-shadow shadow-lg shadow-white/5"
                        >
                          Continue
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Filter Toolbar */}
                      <div className="flex flex-col xl:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                          <input
                            type="text"
                            value={audienceSearchQuery}
                            onChange={(e) => setAudienceSearchQuery(e.target.value)}
                            placeholder="Search by name, email or department..."
                            className="w-full pl-9 pr-4 py-2 rounded-lg bg-black/20 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/30"
                          />
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Departments Filter */}
                          <div className="relative group">
                            <button className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${campaignForm.allowedDepartments?.length
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                              : 'bg-black/20 border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                              }`}>
                              <Building2 size={14} />
                              Departments
                              {campaignForm.allowedDepartments && campaignForm.allowedDepartments.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">
                                  {campaignForm.allowedDepartments.length}
                                </span>
                              )}
                            </button>
                            {/* Popover */}
                            <div className="absolute top-full right-0 mt-2 w-56 p-2 rounded-xl border border-white/10 bg-[#1A1A1A] shadow-xl z-20 invisible opacity-0 translate-y-2 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                              <div className="text-xs font-semibold text-white/40 px-2 py-1 mb-1">Select Departments</div>
                              <div className="max-h-48 overflow-y-auto space-y-0.5">
                                {uniqueDepartments.map(dept => {
                                  const isSelected = campaignForm.allowedDepartments?.includes(dept);
                                  return (
                                    <button
                                      key={dept}
                                      onClick={() => setCampaignForm(prev => ({
                                        ...prev,
                                        allowedDepartments: isSelected
                                          ? prev.allowedDepartments?.filter(d => d !== dept)
                                          : [...(prev.allowedDepartments || []), dept]
                                      }))}
                                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${isSelected ? 'bg-blue-500/10 text-blue-400' : 'text-white/60 hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                      {dept}
                                      {isSelected && <Check size={12} />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Roles Filter */}
                          <div className="relative group">
                            <button className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${campaignForm.allowedRoles?.length
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                              : 'bg-black/20 border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                              }`}>
                              <UserCheck size={14} />
                              Roles
                              {campaignForm.allowedRoles && campaignForm.allowedRoles.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px]">
                                  {campaignForm.allowedRoles.length}
                                </span>
                              )}
                            </button>
                            <div className="absolute top-full right-0 mt-2 w-48 p-2 rounded-xl border border-white/10 bg-[#1A1A1A] shadow-xl z-20 invisible opacity-0 translate-y-2 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                              <div className="text-xs font-semibold text-white/40 px-2 py-1 mb-1">Select Roles</div>
                              <div className="space-y-0.5">
                                {['employee', 'applicant'].map(role => {
                                  const isSelected = campaignForm.allowedRoles?.includes(role as UserRole);
                                  return (
                                    <button
                                      key={role}
                                      onClick={() => setCampaignForm(prev => ({
                                        ...prev,
                                        allowedRoles: isSelected
                                          ? prev.allowedRoles?.filter(r => r !== role)
                                          : [...(prev.allowedRoles || []), role as UserRole]
                                      }))}
                                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs capitalize transition-colors ${isSelected ? 'bg-purple-500/10 text-purple-400' : 'text-white/60 hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                      {role}
                                      {isSelected && <Check size={12} />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Cohorts Filter */}
                          <div className="relative group">
                            <button className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${campaignForm.allowedCohortIds?.length
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-black/20 border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                              }`}>
                              <Users size={14} />
                              Cohorts
                              {campaignForm.allowedCohortIds && campaignForm.allowedCohortIds.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">
                                  {campaignForm.allowedCohortIds.length}
                                </span>
                              )}
                            </button>
                            <div className="absolute top-full right-0 mt-2 w-64 p-2 rounded-xl border border-white/10 bg-[#1A1A1A] shadow-xl z-20 invisible opacity-0 translate-y-2 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                              <div className="text-xs font-semibold text-white/40 px-2 py-1 mb-1">Select Cohorts</div>
                              <div className="max-h-48 overflow-y-auto space-y-0.5">
                                {availableCohorts.map(cohort => {
                                  const isSelected = campaignForm.allowedCohortIds?.includes(cohort.id);
                                  return (
                                    <button
                                      key={cohort.id}
                                      onClick={() => setCampaignForm(prev => ({
                                        ...prev,
                                        allowedCohortIds: isSelected
                                          ? prev.allowedCohortIds?.filter(id => id !== cohort.id)
                                          : [...(prev.allowedCohortIds || []), cohort.id]
                                      }))}
                                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${isSelected ? 'bg-emerald-500/10 text-emerald-400' : 'text-white/60 hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                      <span className="truncate">{cohort.name}</span>
                                      {isSelected && <Check size={12} flex-shrink-0 />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Selection Status Bar - Only visible when specific users are selected */}
                      {isSelectionMode && (
                        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20 mb-4 animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                              {selectedEmployeeIds.length}
                            </span>
                            <span className="text-sm font-medium text-blue-200">
                              Specific users selected
                            </span>
                            <span className="text-xs text-blue-300/60 ml-1">
                              (Filters are now used only for searching)
                            </span>
                          </div>
                          <button
                            onClick={clearSelection}
                            className="text-xs font-medium text-blue-300 hover:text-blue-200 transition-colors"
                          >
                            Clear Selection
                          </button>
                        </div>
                      )}

                      {/* Member List */}
                      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 bg-white/5 text-xs font-semibold uppercase tracking-wider text-white/40">
                          <div className="col-span-6 flex items-center gap-3">
                            <button
                              onClick={handleSelectAllVisible}
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${paginatedAudience.length > 0 && paginatedAudience.every(m => selectedEmployeeIds.includes(m.id))
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'border-white/20 hover:border-white/40'
                                }`}
                            >
                              {paginatedAudience.length > 0 && paginatedAudience.every(m => selectedEmployeeIds.includes(m.id)) && (
                                <Check size={10} strokeWidth={3} />
                              )}
                            </button>
                            Member
                          </div>
                          <div className="col-span-3">Role</div>
                          <div className="col-span-3">Department</div>
                        </div>

                        {/* Rows */}
                        <div className="divide-y divide-white/5">
                          {paginatedAudience.length === 0 ? (
                            <div className="py-12 text-center">
                              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 mb-3">
                                <Users size={20} className="text-white/20" />
                              </div>
                              <p className="text-sm text-white/40">No members match the selected filters.</p>
                            </div>
                          ) : (
                            paginatedAudience.map(member => {
                              const isSelected = selectedEmployeeIds.includes(member.id);
                              return (
                                <div
                                  key={member.id}
                                  onClick={() => toggleUserSelection(member.id)}
                                  className={`grid grid-cols-12 gap-4 px-4 py-3 items-center transition-colors cursor-pointer ${isSelected
                                    ? 'bg-blue-500/5 hover:bg-blue-500/10'
                                    : 'hover:bg-white/5'
                                    }`}
                                >
                                  <div className="col-span-6 flex items-center gap-3">
                                    <div
                                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected
                                        ? 'bg-blue-500 border-blue-500 text-white'
                                        : 'border-white/20 group-hover:border-white/40'
                                        }`}
                                    >
                                      {isSelected && <Check size={10} strokeWidth={3} />}
                                    </div>
                                    <Avatar
                                      src={member.avatar}
                                      name={member.name}
                                      email={member.email}
                                      size="sm"
                                    />
                                    <div className="min-w-0">
                                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-200' : 'text-white'}`}>{member.name}</p>
                                      <p className="text-xs text-white/40 truncate">{member.email}</p>
                                    </div>
                                  </div>
                                  <div className="col-span-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${member.role === 'admin' ? 'bg-purple-500/10 text-purple-400' :
                                      member.role === 'employee' ? 'bg-emerald-500/10 text-emerald-400' :
                                        'bg-white/10 text-white/60'
                                      }`}>
                                      {member.role}
                                    </span>
                                  </div>
                                  <div className="col-span-3">
                                    <span className="text-xs text-white/60">{member.department || '-'}</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Pagination */}
                        {totalAudiencePages > 1 && (
                          <div className="flex items-center justify-between border-t border-white/5 px-4 py-3 bg-white/5">
                            <span className="text-xs text-white/40">
                              Showing {audiencePage * AUDIENCE_PER_PAGE + 1}-{Math.min((audiencePage + 1) * AUDIENCE_PER_PAGE, filteredAudience.length)} of {filteredAudience.length} members
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handlePrevAudiencePage}
                                disabled={audiencePage === 0}
                                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <span className="text-xs text-white/60">
                                Page {audiencePage + 1} of {totalAudiencePages}
                              </span>
                              <button
                                type="button"
                                onClick={handleNextAudiencePage}
                                disabled={audiencePage === totalAudiencePages - 1}
                                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Privacy Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white/5">
                          <Shield size={18} className="text-white/60" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">Anonymous Responses</p>
                          <p className="text-xs text-white/40">Hide participant identity in reports</p>
                        </div>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={campaignForm.anonymousResponses}
                          onChange={(e) => setCampaignForm({ ...campaignForm, anonymousResponses: e.target.checked })}
                        />
                        <div className="h-6 w-11 rounded-full bg-white/10 transition peer-checked:bg-blue-600 peer-focus:outline-none" />
                        <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                      </label>
                    </div>

                    {/* Implicit Targeting Notice */}
                    {!isSelectionMode && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                        <Info size={16} className="text-blue-400 flex-shrink-0" />
                        <p className="text-xs text-blue-200/80">
                          Since no specific users are selected, this campaign will target <strong>everyone</strong> currently matching your filters.
                        </p>
                      </div>
                    )}

                  </div>
                )}

                {/* Step 4: Schedule */}
                {wizardStep === 4 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold text-white mb-2">Schedule & Automation</h2>
                        <p className="text-white/60">Set timelines and automated notifications.</p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handlePrevStep}
                          className="px-6 py-2.5 rounded-xl border border-white/10 text-white/70 font-medium hover:bg-white/5 hover:text-white transition-colors"
                        >
                          Back
                        </button>
                        <button
                          onClick={() => handleSaveCampaign({ publish: false })}
                          disabled={isSavingCampaign}
                          className="px-6 py-2.5 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
                        >
                          Save Draft
                        </button>
                        <button
                          onClick={() => handleSaveCampaign({ publish: true })}
                          disabled={isSavingCampaign}
                          className="px-6 py-2.5 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-shadow shadow-lg shadow-white/5 disabled:opacity-50 flex items-center gap-2"
                        >
                          {isSavingCampaign ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                          Launch Campaign
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-white block">Start Date</label>
                        <input
                          type="date"
                          value={campaignForm.startDate}
                          onChange={(e) => setCampaignForm({ ...campaignForm, startDate: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/40 focus:ring-2 focus:ring-white/15"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-white block">End Date</label>
                        <input
                          type="date"
                          value={campaignForm.endDate}
                          onChange={(e) => setCampaignForm({ ...campaignForm, endDate: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/40 focus:ring-2 focus:ring-white/15"
                        />
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Automation Rules</h4>

                      {[
                        { key: 'autoSendInvites', label: 'Auto-send Invitations', desc: 'Email participants immediately upon launch' },
                        { key: 'sendReminders', label: 'Send Smart Reminders', desc: 'Follow up with users who haven\'t completed' },
                        { key: 'sendConfirmations', label: 'Completion Confirmation', desc: 'Send a success email after completion' }
                      ].map(({ key, label, desc }) => (
                        <label key={key} className="flex items-center justify-between group cursor-pointer">
                          <div>
                            <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">{label}</p>
                            <p className="text-xs text-white/40">{desc}</p>
                          </div>
                          <div className="relative inline-flex items-center">
                            <input
                              type="checkbox"
                              className="peer sr-only"
                              checked={campaignForm[key as keyof typeof campaignForm] as boolean}
                              onChange={(e) => setCampaignForm({ ...campaignForm, [key]: e.target.checked })}
                            />
                            <div className="h-5 w-9 rounded-full bg-white/10 transition peer-checked:bg-blue-600" />
                            <div className="absolute left-1 top-1 h-3 w-3 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                          </div>
                        </label>
                      ))}
                    </div>

                  </div>
                )}



              </div>
              )}
            </main>

          </div>
        </div >
      </div >
    );
  }

  // Render template selection in full-screen mode (without campaign manager UI)
  if (activeTab === 'create' && !showCreateWizard) {
    return (
      <div className="min-h-[80vh] flex flex-col">
        {/* Centered Content */}
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-dark-card border border-dark-border px-4 py-2 text-sm font-medium text-dark-text-muted mb-6">
              <Megaphone className="h-4 w-4" />
              New Campaign
            </div>
            <h1 className="text-4xl font-semibold text-dark-text mb-3">How would you like to start?</h1>
            <p className="text-lg text-dark-text-muted">Choose a template to get started quickly, or build from scratch</p>
          </div>

          {/* Options */}
          <div className="w-full max-w-4xl px-6">
            {/* Templates Row */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {campaignTypes.map((template) => {
                const IconComponent = template.iconComponent;
                return (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template.id)}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-dark-border bg-dark-card text-left transition-all hover:shadow-xl hover:scale-[1.02] hover:border-primary/50"
                  >
                    {/* Gradient Header */}
                    <div className={`h-28 bg-gradient-to-br ${template.color} p-5 flex items-end shrink-0`}>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
                          {IconComponent ? (
                            <IconComponent className="h-4 w-4 text-white" />
                          ) : (
                            <span className="text-sm">{template.icon}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="text-base font-semibold text-dark-text mb-2 group-hover:text-primary transition-colors">{template.name}</h3>
                      <p className="text-sm text-dark-text-muted mb-4 flex-1">{template.description}</p>
                      {template.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {template.skills.slice(0, 2).map((skill) => (
                            <span key={skill.id} className="rounded-md bg-dark-bg px-2 py-1 text-xs font-medium text-dark-text-muted">
                              {skill.name}
                            </span>
                          ))}
                        </div>
                      )}
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
              <div className="flex-1 h-px bg-dark-border" />
              <span className="text-sm text-dark-text-muted font-medium">or</span>
              <div className="flex-1 h-px bg-dark-border" />
            </div>

            {/* Start from Scratch */}
            <button
              onClick={() => {
                setCampaignForm({
                  ...campaignForm,
                  campaignType: 'custom',
                });
                setShowCreateWizard(true);
                setWizardStep(1);
              }}
              className="group w-full flex items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-dark-border bg-dark-card/50 p-6 transition hover:border-primary/50 hover:bg-dark-card"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-dark-bg text-dark-text-muted transition group-hover:bg-primary/10 group-hover:text-primary">
                <Play className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h3 className="text-base font-semibold text-dark-text">Start from Scratch</h3>
                <p className="text-sm text-dark-text-muted">Build a fully custom campaign with your own settings</p>
              </div>
            </button>
          </div>

          {/* Back Link */}
          <button
            onClick={() => setActiveTab('active')}
            className="mt-10 inline-flex items-center gap-2 text-sm text-dark-text-muted hover:text-dark-text transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-dark-border bg-dark-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dark-bg text-dark-text-muted">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-dark-text">{campaigns.length}</p>
              <p className="text-xs text-dark-text-muted">Total</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-dark-border bg-dark-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <PlayCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-dark-text">{campaigns.filter(c => c.status === 'active').length}</p>
              <p className="text-xs text-dark-text-muted">Active</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-dark-border bg-dark-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-dark-text">{campaigns.filter(c => c.status === 'draft').length}</p>
              <p className="text-xs text-dark-text-muted">Drafts</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-dark-border bg-dark-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Pin className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-dark-text">{pinnedCampaigns.length}</p>
              <p className="text-xs text-dark-text-muted">Pinned</p>
            </div>
          </div>
        </div>
      </div>

      {campaignError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          <X className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">{campaignError}</p>
        </div>
      )}

      {/* Loading State - replaces content */}
      {campaignsLoading && campaigns.length === 0 ? (
        <CampaignGridSkeleton />
      ) : (
        <>
          {/* Pinned Active Campaigns */}
          {activeTab !== 'create' && activeTab !== 'dicode' && pinnedCampaigns.length > 0 && (
            <div className="rounded-xl border border-dark-border bg-dark-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Pin size={16} className="text-primary fill-primary" />
                <h3 className="text-sm font-semibold text-dark-text">Pinned Campaigns</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pinnedCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="rounded-lg border border-primary/20 bg-dark-bg p-4 transition hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-dark-text truncate">{campaign.name}</h4>
                        <p className="text-xs text-dark-text-muted line-clamp-1 mt-0.5">{campaign.description}</p>
                      </div>
                      <button
                        onClick={() => togglePinCampaign(campaign.id, campaign.pinned || false)}
                        className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-dark-card transition-colors ml-2"
                        title="Unpin campaign"
                      >
                        <X size={14} className="text-dark-text-muted" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-dark-text-muted mt-3 pt-3 border-t border-dark-border">
                      <span className="inline-flex items-center gap-1">
                        <Users size={12} />
                        {getEnrollmentSummary(campaign)}
                      </span>
                      <span>{completionRates[campaign.id] ?? 0}% complete</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters & Search */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {/* Status Tabs */}
              <div className="flex items-center rounded-lg border border-dark-border bg-dark-card p-1">
                {(['active', 'draft', 'completed', 'dicode'] as const).map((tab) => {
                  const count = getTabCount(tab);
                  const isActive = activeTab === tab;
                  const labels: Record<string, string> = {
                    active: 'Active',
                    draft: 'Draft',
                    completed: 'Completed',
                    dicode: 'DiCode',
                  };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${isActive
                        ? 'bg-dark-bg text-dark-text'
                        : 'text-dark-text-muted hover:text-dark-text'
                        }`}
                    >
                      <span>{labels[tab]}</span>
                      <span className={`text-xs ${isActive ? 'text-primary' : 'text-dark-text-muted'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search & Actions */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-text-muted" />
                <input
                  type="text"
                  className="h-9 w-64 rounded-lg border border-dark-border bg-dark-card pl-9 pr-4 text-sm text-dark-text placeholder:text-dark-text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* View Toggle */}
              <div className="flex items-center rounded-lg border border-dark-border bg-dark-card p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition ${viewMode === 'grid'
                    ? 'bg-dark-bg text-primary'
                    : 'text-dark-text-muted hover:text-dark-text'
                    }`}
                  title="Grid view"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition ${viewMode === 'list'
                    ? 'bg-dark-bg text-primary'
                    : 'text-dark-text-muted hover:text-dark-text'
                    }`}
                  title="List view"
                >
                  <List size={16} />
                </button>
              </div>

              <button
                onClick={handleCreateCampaign}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:bg-primary/90"
              >
                <Plus size={16} />
                New Campaign
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'dicode' && (
            <div>
              {filteredDICodeCampaigns.length > 0 ? (
                viewMode === 'grid' ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredDICodeCampaigns.map((campaign) => renderDICodeCampaignCard(campaign))}
                  </div>
                ) : (
                  renderCampaignsList(filteredDICodeCampaigns, true)
                )
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-dark-border bg-dark-card py-20 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-dark-bg text-dark-text-muted mb-4">
                    <Megaphone className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-semibold text-dark-text">No DiCode campaigns found</h3>
                  <p className="mt-1 text-sm text-dark-text-muted max-w-sm">
                    {searchQuery ? 'Try adjusting your search' : 'No DiCode campaigns available'}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab !== 'create' && activeTab !== 'dicode' && (
            <div>
              {filteredCampaigns.length > 0 ? (
                viewMode === 'grid' ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredCampaigns.map((campaign) => renderCampaignCard(campaign))}
                  </div>
                ) : (
                  renderCampaignsList(filteredCampaigns, false)
                )
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-dark-border bg-dark-card py-20 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-dark-bg text-dark-text-muted mb-4">
                    <Megaphone className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-semibold text-dark-text">
                    {campaigns.length === 0 ? 'No campaigns yet' : 'No matching campaigns'}
                  </h3>
                  <p className="mt-1 text-sm text-dark-text-muted max-w-sm">
                    {searchQuery ? 'Try adjusting your search or filters' : `Create your first ${activeTab} campaign to get started.`}
                  </p>
                  {!searchQuery && campaigns.length === 0 && (
                    <button
                      onClick={handleCreateCampaign}
                      className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90"
                    >
                      <Plus size={16} />
                      Create Campaign
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Note: Template Selection and Create Campaign Wizard are rendered via early returns above */}

          {/* Import Participants Side Panel */}
          <>
            {/* Backdrop */}
            <div
              className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${showImportModal ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              onClick={() => setShowImportModal(false)}
            />

            {/* Slide-over Panel */}
            <div
              className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-dark-card border-l border-dark-border shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-out ${showImportModal ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
              {/* Header */}
              <div className="sticky top-0 bg-dark-card border-b border-dark-border px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Upload className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-dark-text">Import Participants</h2>
                    <p className="text-sm text-dark-text-muted">Add people to your campaign</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="p-2 rounded-lg hover:bg-dark-bg transition"
                >
                  <X className="h-5 w-5 text-dark-text-muted" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                <p className="text-sm text-dark-text-muted">
                  Select an import method to add participants to your campaign.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      alert('CSV upload feature coming soon');
                    }}
                    className="w-full p-5 bg-dark-bg rounded-xl border border-dark-border hover:border-primary transition-colors text-left flex items-center gap-4"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <Upload size={24} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-dark-text">Upload CSV</div>
                      <div className="text-sm text-dark-text-muted mt-0.5">Import participants from a CSV file</div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-dark-text-muted" />
                  </button>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      alert('HRIS sync feature coming soon');
                    }}
                    className="w-full p-5 bg-dark-bg rounded-xl border border-dark-border hover:border-primary transition-colors text-left flex items-center gap-4"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <Building2 size={24} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-dark-text">Sync HRIS</div>
                      <div className="text-sm text-dark-text-muted mt-0.5">Connect to your HR system</div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-dark-text-muted" />
                  </button>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                    }}
                    className="w-full p-5 bg-dark-bg rounded-xl border border-dark-border hover:border-primary transition-colors text-left flex items-center gap-4"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <UserCheck size={24} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-dark-text">Manual Selection</div>
                      <div className="text-sm text-dark-text-muted mt-0.5">Select from your employee list</div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-dark-text-muted" />
                  </button>
                </div>
              </div>
            </div>
          </>

          {/* Edit Participants Side Panel */}
          <>
            {/* Backdrop */}
            <div
              className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${showEditParticipantsModal ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              onClick={() => setShowEditParticipantsModal(false)}
            />

            {/* Slide-over Panel */}
            <div
              className={`fixed right-0 top-0 bottom-0 w-full max-w-xl bg-dark-card border-l border-dark-border shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-out ${showEditParticipantsModal ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
              {/* Header */}
              <div className="sticky top-0 bg-dark-card border-b border-dark-border px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-dark-text">Edit Participants</h2>
                    <p className="text-sm text-dark-text-muted">{campaignForm.participants.length} participants</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditParticipantsModal(false)}
                  className="p-2 rounded-lg hover:bg-dark-bg transition"
                >
                  <X className="h-5 w-5 text-dark-text-muted" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {campaignForm.participants.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-dark-bg text-dark-text-muted mb-4">
                      <Users className="h-7 w-7" />
                    </div>
                    <h3 className="text-lg font-semibold text-dark-text">No participants yet</h3>
                    <p className="text-sm text-dark-text-muted mt-1">Add participants to your campaign</p>
                  </div>
                ) : (
                  <div className="divide-y divide-dark-border">
                    {campaignForm.participants.map((p) => (
                      <div key={p.id} className="px-6 py-4 flex items-center gap-4 hover:bg-white/5 transition">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-sm font-semibold text-primary">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-dark-text truncate">{p.name}</p>
                          <p className="text-xs text-dark-text-muted truncate">{p.email}</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-dark-text-muted">{p.department}</p>
                          <p className="text-xs text-dark-text-muted capitalize">{p.role}</p>
                        </div>
                        <button
                          onClick={() => {
                            setCampaignForm({
                              ...campaignForm,
                              participants: campaignForm.participants.filter(part => part.id !== p.id),
                            });
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-dark-card border-t border-dark-border px-6 py-4">
                <button
                  onClick={() => setShowEditParticipantsModal(false)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            </div>
          </>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isDeleting && setDeleteConfirmId(null)}
          />
          <div className="relative bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-dark-text">Delete Campaign</h3>
                <p className="text-sm text-dark-text-muted">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-dark-text-muted mb-6">
              Are you sure you want to delete <strong className="text-dark-text">{campaigns.find(c => c.id === deleteConfirmId)?.name}</strong>? All associated data including enrollments and responses will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-dark-border text-dark-text text-sm font-medium hover:bg-white/5 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCampaign(deleteConfirmId)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Campaign
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DiCode Enrollment Modal */}
      {enrollmentModalCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isEnrolling && handleCloseEnrollmentModal()}
          />
          <div className="relative bg-dark-card border border-dark-border rounded-2xl w-full max-w-2xl mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-dark-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-dark-text">Manage Enrollments</h3>
                  <p className="text-sm text-dark-text-muted mt-1">{enrollmentModalCampaign.name}</p>
                </div>
                <button
                  onClick={handleCloseEnrollmentModal}
                  disabled={isEnrolling}
                  className="p-2 rounded-lg hover:bg-white/5 transition"
                >
                  <X size={20} className="text-dark-text-muted" />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-dark-border space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  value={enrollmentSearchQuery}
                  onChange={(e) => { setEnrollmentSearchQuery(e.target.value); setEnrollmentPage(0); }}
                  placeholder="Search by name, email or department..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-black/20 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/30"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Departments Filter */}
                <div className="relative group">
                  <button className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${enrollmentSelectedDepartments.length > 0
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : 'bg-black/20 border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                    }`}>
                    <Building2 size={14} />
                    Departments
                    {enrollmentSelectedDepartments.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">
                        {enrollmentSelectedDepartments.length}
                      </span>
                    )}
                  </button>
                  <div className="absolute top-full left-0 mt-2 w-56 p-2 rounded-xl border border-white/10 bg-[#1A1A1A] shadow-xl z-20 invisible opacity-0 translate-y-2 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                    <div className="text-xs font-semibold text-white/40 px-2 py-1 mb-1">Select Departments</div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {uniqueDepartments.map(dept => {
                        const isSelected = enrollmentSelectedDepartments.includes(dept);
                        return (
                          <button
                            key={dept}
                            onClick={() => {
                              setEnrollmentSelectedDepartments(prev =>
                                isSelected ? prev.filter(d => d !== dept) : [...prev, dept]
                              );
                              setEnrollmentPage(0);
                            }}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${isSelected ? 'bg-blue-500/10 text-blue-400' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                          >
                            {dept}
                            {isSelected && <Check size={12} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Cohorts Filter */}
                <div className="relative group">
                  <button className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${enrollmentSelectedCohorts.length > 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-black/20 border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                    }`}>
                    <Users size={14} />
                    Cohorts
                    {enrollmentSelectedCohorts.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">
                        {enrollmentSelectedCohorts.length}
                      </span>
                    )}
                  </button>
                  <div className="absolute top-full left-0 mt-2 w-64 p-2 rounded-xl border border-white/10 bg-[#1A1A1A] shadow-xl z-20 invisible opacity-0 translate-y-2 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                    <div className="text-xs font-semibold text-white/40 px-2 py-1 mb-1">Select Cohorts</div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {availableCohorts.map(cohort => {
                        const isSelected = enrollmentSelectedCohorts.includes(cohort.id);
                        return (
                          <button
                            key={cohort.id}
                            onClick={() => {
                              setEnrollmentSelectedCohorts(prev =>
                                isSelected ? prev.filter(id => id !== cohort.id) : [...prev, cohort.id]
                              );
                              setEnrollmentPage(0);
                            }}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${isSelected ? 'bg-emerald-500/10 text-emerald-400' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                          >
                            <span className="truncate">{cohort.name}</span>
                            {isSelected && <Check size={12} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Selection Status */}
                {enrollmentSelectedEmployees.length > 0 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-emerald-400 font-medium">
                      {enrollmentSelectedEmployees.length} selected
                    </span>
                    <button
                      onClick={() => setEnrollmentSelectedEmployees([])}
                      className="text-xs text-white/50 hover:text-white transition"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Employee List */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="divide-y divide-dark-border">
                {/* Header Row */}
                <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-dark-bg text-xs font-semibold uppercase tracking-wider text-dark-text-muted sticky top-0">
                  <div className="col-span-6 flex items-center gap-3">
                    <button
                      onClick={selectAllEnrollmentEmployees}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${paginatedEnrollmentEmployees.length > 0 && paginatedEnrollmentEmployees.every(e => enrollmentSelectedEmployees.includes(e.id))
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-white/20 hover:border-white/40'
                        }`}
                    >
                      {paginatedEnrollmentEmployees.length > 0 && paginatedEnrollmentEmployees.every(e => enrollmentSelectedEmployees.includes(e.id)) && (
                        <Check size={10} strokeWidth={3} />
                      )}
                    </button>
                    Employee
                  </div>
                  <div className="col-span-3">Role</div>
                  <div className="col-span-3">Department</div>
                </div>

                {/* Employee Rows */}
                {paginatedEnrollmentEmployees.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users size={24} className="mx-auto text-white/20 mb-2" />
                    <p className="text-sm text-white/40">No employees match the filters</p>
                  </div>
                ) : (
                  paginatedEnrollmentEmployees.map(employee => {
                    const isSelected = enrollmentSelectedEmployees.includes(employee.id);
                    return (
                      <div
                        key={employee.id}
                        onClick={() => toggleEnrollmentEmployee(employee.id)}
                        className={`grid grid-cols-12 gap-4 px-4 py-3 items-center cursor-pointer transition-colors ${isSelected ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 'hover:bg-white/5'}`}
                      >
                        <div className="col-span-6 flex items-center gap-3">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/20'}`}>
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </div>
                          <Avatar src={employee.avatar} name={employee.name} email={employee.email} size="sm" />
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-emerald-200' : 'text-white'}`}>{employee.name}</p>
                            <p className="text-xs text-white/40 truncate">{employee.email}</p>
                          </div>
                        </div>
                        <div className="col-span-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${employee.role === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {employee.role}
                          </span>
                        </div>
                        <div className="col-span-3">
                          <span className="text-xs text-white/60">{employee.department || '-'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Pagination */}
            {totalEnrollmentPages > 1 && (
              <div className="flex items-center justify-between border-t border-dark-border px-4 py-3 bg-dark-bg">
                <span className="text-xs text-white/40">
                  Showing {enrollmentPage * ENROLLMENT_PER_PAGE + 1}-{Math.min((enrollmentPage + 1) * ENROLLMENT_PER_PAGE, filteredEnrollmentEmployees.length)} of {filteredEnrollmentEmployees.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEnrollmentPage(p => Math.max(0, p - 1))}
                    disabled={enrollmentPage === 0}
                    className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-white/60">
                    Page {enrollmentPage + 1} of {totalEnrollmentPages}
                  </span>
                  <button
                    onClick={() => setEnrollmentPage(p => Math.min(totalEnrollmentPages - 1, p + 1))}
                    disabled={enrollmentPage === totalEnrollmentPages - 1}
                    className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-dark-border bg-dark-bg/50">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/50">
                  {enrollmentSelectedEmployees.length > 0
                    ? `${enrollmentSelectedEmployees.length} employees will be enrolled`
                    : `${filteredEnrollmentEmployees.length} employees matching filters will be enrolled`
                  }
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleCloseEnrollmentModal}
                    disabled={isEnrolling}
                    className="px-4 py-2 rounded-xl border border-dark-border text-dark-text text-sm font-medium hover:bg-white/5 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkEnroll}
                    disabled={isEnrolling || (enrollmentSelectedEmployees.length === 0 && filteredEnrollmentEmployees.length === 0)}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {isEnrolling ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Enrolling...
                      </>
                    ) : (
                      <>
                        <UserCheck size={16} />
                        Enroll Employees
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignManagement;