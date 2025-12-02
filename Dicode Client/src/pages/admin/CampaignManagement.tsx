import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Employee, Campaign as FirestoreCampaign, Cohort } from '@/types';
import {
  Megaphone,
  Plus,
  Search,
  Edit,
  Trash2,
  Calendar,
  Users,
  Video as VideoIcon,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Target,
  CheckCircle,
  PlayCircle,
  Repeat,
  Upload,
  FileText,
  Eye,
  Copy,
  Pause,
  Play,
  Mail,
  Bell,
  ArrowRight,
  ArrowLeft,
  Check,
  Power,
  UserCheck,
  TrendingUp,
  Building2,
  Pin,
  GripVertical,
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
} from '@/lib/firestore';
import { COMPETENCIES, type SkillDefinition } from '@/lib/competencies';
import type { Video } from '@/types';

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
  id: 'leadership-checkin' | 'competency-pulse' | 'skills-tomorrow' | 'custom';
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
    name: 'Leadership Check-in',
    description: 'Pulse checks to understand team perspectives and drive psychological safety',
    color: 'from-blue-500 to-blue-700',
    icon: '👥',
    iconComponent: UserCheck,
    skills: [
      { id: 'psych-safety', name: 'Psychological Safety', description: 'Build trust and openness' },
      { id: 'feedback', name: 'Feedback Culture', description: 'Foster constructive dialogue' },
    ],
  },
  {
    id: 'competency-pulse',
    name: 'Competency Pulse',
    description: 'Track skill development and identify growth opportunities',
    color: 'from-purple-500 to-purple-700',
    icon: '📊',
    iconComponent: TrendingUp,
    skills: [
      { id: 'collaboration', name: 'Collaboration', description: 'Strengthen teamwork' },
      { id: 'growth', name: 'Growth Mindset', description: 'Encourage continuous learning' },
    ],
  },
  {
    id: 'skills-tomorrow',
    name: 'Skills for Tomorrow',
    description: 'Future-proof your workforce with emerging competencies',
    color: 'from-green-500 to-green-700',
    icon: '🚀',
    iconComponent: Building2,
    skills: [
      { id: 'innovation', name: 'Innovation', description: 'Drive creative thinking' },
      { id: 'adaptability', name: 'Adaptability', description: 'Embrace change' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Campaign',
    description: 'Design your own campaign with flexible targeting and content',
    color: 'from-gray-500 to-gray-700',
    icon: '⚙️',
    iconComponent: Target,
    skills: [],
  },
];

type TargetingMode = 'all' | 'departments' | 'cohorts' | 'employees';

const CampaignManagement = () => {
  const { user } = useAuth();
  // Main tab state
  const [activeTab, setActiveTab] = useState<'active' | 'draft' | 'completed' | 'create' | 'dicode'>('active' as 'active' | 'draft' | 'completed' | 'create' | 'dicode');

  // Create campaign wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [competencyValidationError, setCompetencyValidationError] = useState<string>('');
  const [viewingCampaignId, setViewingCampaignId] = useState<string | null>(null);

  // Video selection state
  const [availableVideos, setAvailableVideos] = useState<Video[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);

  // Video search and filter state
  const [videoSearchQuery, setVideoSearchQuery] = useState('');
  const [selectedVideoCompetency, setSelectedVideoCompetency] = useState<string>('all');
  const [videoSortBy, setVideoSortBy] = useState<string>('date-desc');

  // Employee list (loaded from Firestore)
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);

  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeDepartmentFilter, setEmployeeDepartmentFilter] = useState<string>('all');
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState<string>('all'); // Disabled - will be enabled once role field is added to Employee
  const [employeeRegionFilter, setEmployeeRegionFilter] = useState<string>('all'); // Disabled - will be enabled once region field is added to Employee
  const [employeeCohortFilter, setEmployeeCohortFilter] = useState<string>('all');

  // Available cohorts for targeting
  const [availableCohorts, setAvailableCohorts] = useState<Cohort[]>([]);

  const [targetingMode, setTargetingMode] = useState<TargetingMode>('all');
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});
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
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);

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
    (config: { allowedDepartments?: string[] | null; allowedEmployeeIds?: string[] | null; allowedCohortIds?: string[] | null }) => {
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
    return getEligibleCountForConfig({});
  }, [
    campaignForm.allowedDepartments,
    campaignForm.allowedCohortIds,
    campaignForm.allowedEmployeeIds,
    getEligibleCountForConfig,
    targetingMode,
  ]);

  const loadEnrollmentCounts = useCallback(async (campaignList: Campaign[]) => {
    if (campaignList.length === 0) {
      setEnrollmentCounts({});
      return;
    }

    const results: Record<string, number> = {};
    await Promise.all(
      campaignList.map(async (campaign) => {
        try {
          const enrollments = await getCampaignEnrollments(campaign.id);
          results[campaign.id] = enrollments.length;
        } catch (error) {
          console.error('Failed to fetch enrollments for campaign', campaign.id, error);
        }
      })
    );

    setEnrollmentCounts(results);
  }, []);

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

  // Toggle pin status for a campaign
  const togglePinCampaign = useCallback(async (campaignId: string, currentPinned: boolean) => {
    try {
      console.log('Toggling pin for campaign:', campaignId, 'from', currentPinned, 'to', !currentPinned);
      await updateCampaign(campaignId, { pinned: !currentPinned });
      console.log('Pin update successful, refreshing campaigns...');
      await refreshCampaigns();
      console.log('Campaigns refreshed');
    } catch (error) {
      console.error('Failed to toggle pin status:', error);
      setCampaignError('Failed to update pin status. Please try again.');
      alert('Failed to update pin status: ' + (error as Error).message);
    }
  }, [refreshCampaigns]);

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
    if (showCreateWizard) {
      setIsLoadingVideos(true);
      getAllVideos()
        .then((videos) => {
          setAvailableVideos(videos);
        })
        .catch((err) => console.error('Failed to load videos:', err))
        .finally(() => setIsLoadingVideos(false));
    }
  }, [showCreateWizard]);

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

        return matchesSearch && matchesCompetency;
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
  }, [availableVideos, videoSearchQuery, selectedVideoCompetency, videoSortBy]);

  // Check if video filters are active
  const hasActiveVideoFilters = selectedVideoCompetency !== 'all' || videoSortBy !== 'date-desc';

  // Clear video filters
  const clearVideoFilters = () => {
    setSelectedVideoCompetency('all');
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
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

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
    });
  };

  // Handle template selection - start wizard with template
  const handleTemplateSelect = (templateId: string) => {
    const template = campaignTypes.find(t => t.id === templateId);
    if (template) {
      setCampaignForm(prev => ({
        ...prev,
        campaignType: template.id,
      }));
    }
    setShowCreateWizard(true);
    setWizardStep(1);
  };

  // Handle wizard navigation
  const handleNextStep = () => {
    // Validate Target Competencies on step 1
    if (wizardStep === 1) {
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

      // Clear error if validation passes
      setCompetencyValidationError('');
    }

    // Validate video selection on step 2
    if (wizardStep === 2) {
      if (selectedVideoIds.length === 0) {
        setCampaignError('Please select at least one video for this campaign');
        return;
      }
      setCampaignError(null);
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
    try {
      await setCampaignPublishState(campaignId, publish);
      await refreshCampaigns();
    } catch (error) {
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
    try {
      await deleteCampaignDoc(campaignId);
      await refreshCampaigns();
    } catch (error) {
      console.error('Failed to delete campaign', error);
      setCampaignError('Failed to delete campaign.');
    }
  };

  // Render DICode campaign card
  const renderDICodeCampaignCard = (campaign: Campaign) => {
    const enrollmentSummary = getEnrollmentSummary(campaign);
    return (
      <div key={campaign.id} className="rounded-xl border border-dark-border bg-dark-card p-5 transition hover:border-dark-border/80 hover:shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400">
                <Megaphone size={12} />
                DiCode
              </span>
            </div>
            <h3 className="text-base font-semibold text-dark-text mb-1">{campaign.name}</h3>
            <p className="text-sm text-dark-text-muted line-clamp-2 mb-3">{campaign.description}</p>
            {campaign.purpose && (
              <div className="rounded-lg border border-dark-border bg-dark-bg p-3 mb-3">
                <p className="text-xs font-medium text-dark-text-muted uppercase tracking-wider mb-1">Purpose</p>
                <p className="text-sm text-dark-text">{campaign.purpose}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              {campaign.targetCompetencies?.slice(0, 3).map((comp: string) => (
                <span key={comp} className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  {comp}
                </span>
              ))}
              {campaign.targetCompetencies && campaign.targetCompetencies.length > 3 && (
                <span className="inline-flex items-center rounded-md bg-dark-bg px-2 py-1 text-xs text-dark-text-muted">
                  +{campaign.targetCompetencies.length - 3}
                </span>
              )}
              </div>
            <div className="flex items-center gap-4 text-xs text-dark-text-muted">
              <span className="inline-flex items-center gap-1">
                <Calendar size={14} />
                {formatDate(campaign.createdDate)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users size={14} />
                {enrollmentSummary}
                </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-3 border-t border-dark-border">
          <button
            onClick={() => {
              setCampaignForm({ ...campaignForm, campaignType: 'leadership-checkin' });
              handleCreateCampaign();
              setWizardStep(1);
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90"
          >
            <Power size={16} />
            Activate Campaign
          </button>
          <button
            onClick={() => setExpandedCampaign(expandedCampaign === campaign.id ? null : campaign.id)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-dark-border bg-dark-bg text-dark-text transition hover:bg-dark-card"
          >
            {expandedCampaign === campaign.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
        {expandedCampaign === campaign.id && (
          <div className="mt-4 pt-4 border-t border-dark-border">
            <h4 className="text-sm font-semibold text-dark-text mb-3">Campaign Details</h4>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-dark-text mb-2">Target Competencies & Skills</p>
                <div className="space-y-3">
                  {campaign.targetCompetencies?.map((compName: string) => {
                    // Find the competency by name
                    const comp = competencies.find(c => c.name === compName);
                    if (!comp) return null;

                    // Get selected skills for this competency (if available)
                    const skillIds = (campaign as any).selectedSkills?.[comp.id] || [];
                    const selectedSkills = comp.skills.filter(s => skillIds.includes(s.id));

                    return (
                      <div key={comp.id} className="bg-dark-bg rounded-lg p-3">
                        <div className="font-medium text-dark-text mb-2">{comp.name}</div>
                        {selectedSkills.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedSkills.map((skill) => (
                              <span key={skill.id} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                                {skill.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-dark-text-muted italic">No skills selected</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render campaign card
  const renderCampaignCard = (campaign: Campaign) => {
    const enrollmentSummary = getEnrollmentSummary(campaign);
    const enrolledCount = enrollmentCounts[campaign.id] ?? 0;
    const eligibleCount = eligibleCounts[campaign.id];
    return (
      <div key={campaign.id} className="rounded-xl border border-dark-border bg-dark-card p-5 transition hover:border-dark-border/80 hover:shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(campaign.status)}`}>
                {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
              </span>
              {campaign.pinned && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Pin size={12} className="fill-primary" />
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold text-dark-text mb-1">{campaign.name}</h3>
            <p className="text-sm text-dark-text-muted line-clamp-2 mb-3">{campaign.description}</p>
            <div className="flex items-center gap-4 text-xs text-dark-text-muted">
              <span className="inline-flex items-center gap-1">
                <Calendar size={14} />
                {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users size={14} />
                {enrollmentSummary}
              </span>
              <span className="inline-flex items-center gap-1">
                <Target size={14} />
                {campaign.completionRate}%
              </span>
              </div>
              </div>
          <div className="flex gap-1">
            <button
              onClick={() => setExpandedCampaign(expandedCampaign === campaign.id ? null : campaign.id)}
              className="p-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text hover:bg-dark-card transition-colors"
              title="View Details"
            >
              <Eye size={18} />
            </button>
            {campaign.status === 'draft' && (
              <>
                <button
                  onClick={() => handleEditCampaign(campaign)}
                  className="p-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text hover:bg-dark-card transition-colors"
                  title="Edit Campaign"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => handleCampaignStatusChange(campaign.id, true)}
                  className="p-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text hover:bg-dark-card transition-colors"
                  title="Launch"
                >
                  <Play size={18} />
                </button>
              </>
            )}
            {campaign.status === 'active' && (
              <>
                <button
                  onClick={() => togglePinCampaign(campaign.id, campaign.pinned || false)}
                  className={`p-2 bg-dark-bg border border-dark-border rounded-lg transition-colors ${campaign.pinned
                    ? 'text-primary border-primary/50 hover:bg-primary/10'
                    : 'text-dark-text hover:bg-dark-card'
                    }`}
                  title={campaign.pinned ? "Unpin campaign" : "Pin campaign"}
                >
                  <Pin size={18} className={campaign.pinned ? 'fill-primary' : ''} />
                </button>
                <button
                  onClick={() => handleCampaignStatusChange(campaign.id, false)}
                  className="p-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text hover:bg-dark-card transition-colors"
                  title="Pause"
                >
                  <Pause size={18} />
                </button>
                <button
                  onClick={() => setViewingCampaignId(campaign.id)}
                  className="p-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text hover:bg-dark-card transition-colors"
                  title="View Assessment & Data"
                >
                  <TrendingUp size={18} />
                </button>
              </>
            )}
            <button
              onClick={() => handleDuplicateCampaign(campaign)}
              className="p-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text hover:bg-dark-card transition-colors"
              title="Duplicate"
            >
              <Copy size={18} />
            </button>
            <button
              onClick={() => handleDeleteCampaign(campaign.id)}
              className="p-2 bg-dark-bg border border-red-500/50 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        {expandedCampaign === campaign.id && (
          <div className="mt-4 pt-4 border-t border-dark-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">

              {/* Description */}
              <div className="md:col-span-2">
                <p className="text-dark-text-muted mb-2 font-medium">Description</p>
                <p className="text-dark-text">{campaign.description}</p>
              </div>

              {/* Target Competencies & Skills */}
              <div className="md:col-span-2">
                <p className="text-dark-text-muted mb-2 font-medium">Target Competencies & Skills</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {campaign.targetCompetencies.map((compName) => {
                    const comp = competencies.find(c => c.name === compName);
                    if (!comp) return null;
                    const skillIds = campaign.selectedSkills?.[comp.id] || [];
                    const selectedSkills = comp.skills.filter(s => skillIds.includes(s.id));
                    return (
                      <div key={comp.id} className="bg-dark-bg rounded-lg p-3">
                        <div className="font-medium text-dark-text mb-2">{comp.name}</div>
                        {selectedSkills.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedSkills.map((skill) => (
                              <span key={skill.id} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                                {skill.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-dark-text-muted italic">No skills selected</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Schedule & Frequency */}
              <div>
                <p className="text-dark-text-muted mb-2 font-medium">Schedule & Frequency</p>
                <div className="bg-dark-bg rounded-lg p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted">Frequency:</span>
                    <span className="text-dark-text font-medium capitalize">{campaign.frequency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted">Start Date:</span>
                    <span className="text-dark-text">{formatDate(campaign.startDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted">End Date:</span>
                    <span className="text-dark-text">{formatDate(campaign.endDate)}</span>
                  </div>
                </div>
              </div>

              {/* Access Control */}
              <div>
                <p className="text-dark-text-muted mb-2 font-medium">Access Control</p>
                <div className="bg-dark-bg rounded-lg p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted">One-Time Access:</span>
                    <span className={`font-medium ${campaign.oneTimeAccess ? 'text-primary' : 'text-dark-text-muted'}`}>
                      {campaign.oneTimeAccess ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted">Anonymous Responses:</span>
                    <span className={`font-medium ${campaign.anonymousResponses ? 'text-primary' : 'text-dark-text-muted'}`}>
                      {campaign.anonymousResponses ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Automation Settings */}
              <div>
                <p className="text-dark-text-muted mb-2 font-medium">Automation</p>
                <div className="bg-dark-bg rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {campaign.autoSendInvites ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <X size={16} className="text-dark-text-muted" />
                    )}
                    <span className="text-dark-text">Auto-send Invites</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {campaign.sendReminders ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <X size={16} className="text-dark-text-muted" />
                    )}
                    <span className="text-dark-text">Send Reminders</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {campaign.sendConfirmations ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <X size={16} className="text-dark-text-muted" />
                    )}
                    <span className="text-dark-text">Send Confirmations</span>
                  </div>
                </div>
              </div>

              {/* Participant Stats */}
              <div>
                <p className="text-dark-text-muted mb-2 font-medium">Participants</p>
                <div className="bg-dark-bg rounded-lg p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted">Enrolled:</span>
                    <span className="text-dark-text font-medium">{enrolledCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted">Eligible:</span>
                    <span className="text-dark-text font-medium">{eligibleCount ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted">Enrollment Rate:</span>
                    <span className="text-primary font-medium">
                      {eligibleCount ? `${Math.min(100, Math.round((enrolledCount / eligibleCount) * 100))}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted">Completion Rate:</span>
                    <span className="text-primary font-medium">{campaign.completionRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted">Total Responses:</span>
                    <span className="text-dark-text font-medium">{campaign.totalResponses}</span>
                  </div>
                </div>
              </div>

              {/* Campaign Content/Videos */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-dark-text-muted font-medium">Campaign Content</p>
                  <span className="text-xs text-dark-text-muted">
                    {campaign.customContent?.length || 0} item{(campaign.customContent?.length || 0) !== 1 ? 's' : ''}
                  </span>
                </div>
                {campaign.customContent && campaign.customContent.length > 0 ? (
                  <div className="space-y-2">
                    {campaign.customContent.map((item, index) => (
                      <div key={item.id} className="bg-dark-bg rounded-lg p-3 flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-medium text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <VideoIcon size={16} className="text-dark-text-muted" />
                            <span className="text-dark-text font-medium">{item.title}</span>
                          </div>
                          <span className="text-xs text-dark-text-muted capitalize">{item.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-dark-bg rounded-lg p-6 text-center">
                    <VideoIcon size={32} className="text-dark-text-muted mx-auto mb-2 opacity-50" />
                    <p className="text-dark-text-muted text-sm">No content added yet</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
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
  if (activeTab === 'create' && showCreateWizard) {
  return (
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Wizard Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setShowCreateWizard(false);
                setEditingCampaignId(null);
                setActiveTab('active');
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-dark-border bg-dark-card text-dark-text-muted transition hover:bg-dark-bg hover:text-dark-text"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          <div>
              <h2 className="text-xl font-semibold text-dark-text">
                {editingCampaignId ? 'Edit Campaign' : 'New Campaign'}
              </h2>
              <p className="text-sm text-dark-text-muted">Step {wizardStep} of 4</p>
            </div>
          </div>

          {/* Progress Steps - Horizontal Pills */}
          <div className="hidden items-center gap-2 lg:flex">
            {[
              { id: 1, label: 'Setup' },
              { id: 2, label: 'Videos' },
              { id: 3, label: 'Audience' },
              { id: 4, label: 'Schedule' },
            ].map((step) => (
              <button
                key={step.id}
                onClick={() => {
                  if (step.id < wizardStep) setWizardStep(step.id);
                }}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  wizardStep === step.id
                    ? 'bg-primary text-white'
                    : wizardStep > step.id
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-dark-card border border-dark-border text-dark-text-muted'
                }`}
              >
                {wizardStep > step.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${wizardStep === step.id ? 'bg-white/20' : 'bg-dark-bg'}`}>{step.id}</span>
                )}
                {step.label}
              </button>
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
          {/* Main Form Column */}
          <div className="space-y-6">

          {/* Step 1: Campaign Setup */}
          {wizardStep === 1 && (
            <div className="space-y-8">
              <div className="rounded-2xl border border-dark-border bg-dark-card p-6">
                <h3 className="text-lg font-semibold text-dark-text mb-6">Campaign Details</h3>
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-medium text-dark-text mb-2 block">Campaign name *</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-sm text-dark-text placeholder:text-dark-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g., Q2 Leadership Pulse"
                      value={campaignForm.name}
                      onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-dark-text mb-2 block">Program summary *</label>
                    <textarea
                      className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-sm text-dark-text placeholder:text-dark-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-none"
                      placeholder="Why are we running this campaign?"
                      value={campaignForm.description}
                      onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-dark-border bg-dark-card p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-lg font-semibold text-dark-text">Target competencies</h3>
                    <p className="text-sm text-dark-text-muted">Select 3-5 competencies and pair them with specific skills</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                    campaignForm.targetCompetencies.length >= 3 && campaignForm.targetCompetencies.length <= 5
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-dark-bg text-dark-text-muted'
                  }`}>
                    {campaignForm.targetCompetencies.length}/5 selected
                  </span>
                </div>

                {competencyValidationError && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400 mb-5">
                    {competencyValidationError}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  {competencies.map((comp) => {
                    const isSelected = campaignForm.targetCompetencies.includes(comp.name);
                    return (
                      <button
                        key={comp.id}
                        onClick={() => {
                          setCampaignForm({
                            ...campaignForm,
                            targetCompetencies: isSelected
                              ? campaignForm.targetCompetencies.filter(c => c !== comp.name)
                              : [...campaignForm.targetCompetencies, comp.name],
                            selectedSkills: isSelected
                              ? (() => {
                                const { [comp.id]: removed, ...rest } = campaignForm.selectedSkills;
                                return rest;
                              })()
                              : { ...campaignForm.selectedSkills, [comp.id]: [] },
                          });
                          setCompetencyValidationError('');
                        }}
                        type="button"
                        className={`group relative flex items-start gap-3 rounded-xl border p-4 text-left transition ${isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-dark-border bg-dark-bg hover:border-dark-border/80'
                          }`}
                      >
                        <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${
                          isSelected ? 'border-primary bg-primary text-white' : 'border-dark-border'
                        }`}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${isSelected ? 'text-dark-text' : 'text-dark-text'}`}>{comp.name}</p>
                          <p className="mt-0.5 text-xs text-dark-text-muted">{comp.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {campaignForm.targetCompetencies.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <h4 className="text-sm font-semibold text-dark-text">Skills & behaviors</h4>
                    {competencies
                      .filter(comp => campaignForm.targetCompetencies.includes(comp.name))
                      .map((comp) => (
                        <div key={comp.id} className="rounded-xl border border-dark-border bg-dark-bg p-4">
                          <p className="text-sm font-semibold text-dark-text mb-3">{comp.name}</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {comp.skills.map((skill) => {
                              const isSelected = campaignForm.selectedSkills[comp.id]?.includes(skill.id) ?? false;
                              return (
                                <label
                                  key={skill.id}
                                  className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition cursor-pointer ${isSelected ? 'border-primary bg-primary/5' : 'border-dark-border hover:border-dark-border/80'
                                    }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const currentSkills = campaignForm.selectedSkills[comp.id] || [];
                                      setCampaignForm({
                                        ...campaignForm,
                                        selectedSkills: {
                                          ...campaignForm.selectedSkills,
                                          [comp.id]: e.target.checked
                                            ? [...currentSkills, skill.id]
                                            : currentSkills.filter(id => id !== skill.id),
                                        },
                                      });
                                      setCompetencyValidationError('');
                                    }}
                                    className="mt-0.5 rounded border-dark-border text-primary focus:ring-primary"
                                  />
                                  <div>
                                    <p className="font-medium text-dark-text">{skill.name}</p>
                                    <p className="text-xs text-dark-text-muted line-clamp-2">{skill.description}</p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Select Videos */}
          {wizardStep === 2 && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-dark-border bg-dark-card p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-lg font-semibold text-dark-text">Video Modules</h3>
                    <p className="text-sm text-dark-text-muted">Select videos to include in this campaign</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-text-muted" />
                      <input
                        type="text"
                        value={videoSearchQuery}
                        onChange={(e) => setVideoSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-40 rounded-lg border border-dark-border bg-dark-bg py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>

                {isLoadingVideos ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-dark-border border-t-primary" />
                  </div>
                ) : filteredVideos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-dark-border py-12 text-center">
                    <Play className="mb-3 h-8 w-8 text-dark-text-muted" />
                    <p className="text-sm text-dark-text-muted">
                      {availableVideos.length === 0 ? 'No videos in your library yet' : 'No matching videos'}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredVideos.map((video) => {
                      const isSelected = selectedVideoIds.includes(video.id);
                      return (
                        <button
                          key={video.id}
                          type="button"
                          onClick={() => {
                            setSelectedVideoIds(prev =>
                              isSelected
                                ? prev.filter(id => id !== video.id)
                                : [...prev, video.id]
                            );
                          }}
                          className={`group relative flex flex-col overflow-hidden rounded-xl border transition ${
                            isSelected
                              ? 'border-primary ring-2 ring-primary'
                              : 'border-dark-border hover:border-dark-border/80'
                          }`}
                        >
                          <div className="relative aspect-video bg-dark-bg">
                            {video.thumbnailUrl ? (
                              <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Play className="h-8 w-8 text-dark-text-muted" />
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                                  <Check className="h-4 w-4 text-white" />
                                </div>
                              </div>
                            )}
                            <span className={`absolute right-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-medium ${
                              video.source === 'generated' ? 'bg-primary text-white' : 'bg-dark-text text-dark-bg'
                            }`}>
                              {video.source === 'generated' ? 'AI' : 'Upload'}
                            </span>
                          </div>
                          <div className="p-3 text-left">
                            <p className="line-clamp-1 text-sm font-medium text-dark-text">{video.title}</p>
                            <p className="text-xs text-dark-text-muted">
                              {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : '—'}
            </p>
          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Audience Management */}
          {wizardStep === 3 && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-dark-border bg-dark-card p-6">
                <h3 className="text-lg font-semibold text-dark-text mb-5">Audience Targeting</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {targetingOptions.map((option) => {
                    const isActive = targetingMode === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setTargetingMode(option.id)}
                        className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
                          isActive
                            ? 'border-primary bg-primary/10'
                            : 'border-dark-border bg-dark-bg hover:border-dark-border/80'
                        }`}
                      >
                        <option.icon className={`h-5 w-5 mb-2 ${isActive ? 'text-primary' : 'text-dark-text-muted'}`} />
                        <p className={`text-sm font-medium ${isActive ? 'text-dark-text' : 'text-dark-text'}`}>{option.label}</p>
                        <p className="text-xs text-dark-text-muted mt-0.5">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {targetingMode === 'department' && (
                <div className="rounded-2xl border border-dark-border bg-dark-card p-6">
                  <h4 className="text-sm font-semibold text-dark-text mb-4">Select Departments</h4>
                  <div className="flex flex-wrap gap-2">
                    {uniqueDepartments.map((dept) => {
                      const isSelected = campaignForm.allowedDepartments?.includes(dept);
                      return (
                        <button
                          key={dept}
                          onClick={() => {
                            setCampaignForm({
                              ...campaignForm,
                              allowedDepartments: isSelected
                                ? campaignForm.allowedDepartments?.filter(d => d !== dept)
                                : [...(campaignForm.allowedDepartments || []), dept],
                            });
                          }}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            isSelected
                              ? 'bg-primary text-white'
                              : 'bg-dark-bg border border-dark-border text-dark-text hover:border-dark-border/80'
                          }`}
                        >
                          {dept}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {targetingMode === 'cohort' && (
                <div className="rounded-2xl border border-dark-border bg-dark-card p-6">
                  <h4 className="text-sm font-semibold text-dark-text mb-4">Select Cohorts</h4>
                  <div className="flex flex-wrap gap-2">
                    {availableCohorts.map((cohort) => {
                      const isSelected = campaignForm.allowedCohortIds?.includes(cohort.id);
                      return (
                        <button
                          key={cohort.id}
                          onClick={() => {
                            setCampaignForm({
                              ...campaignForm,
                              allowedCohortIds: isSelected
                                ? campaignForm.allowedCohortIds?.filter(id => id !== cohort.id)
                                : [...(campaignForm.allowedCohortIds || []), cohort.id],
                            });
                          }}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            isSelected
                              ? 'bg-primary text-white'
                              : 'bg-dark-bg border border-dark-border text-dark-text hover:border-dark-border/80'
                          }`}
                        >
                          {cohort.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-dark-border bg-dark-card p-6">
                <h4 className="text-sm font-semibold text-dark-text mb-4">Privacy Settings</h4>
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dark-border p-4 transition hover:bg-dark-bg">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dark-bg">
                      <Users className="h-5 w-5 text-dark-text-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-dark-text">Anonymous Responses</p>
                      <p className="text-xs text-dark-text-muted">Hide participant identity in reports</p>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={campaignForm.anonymousResponses}
                      onChange={(e) => setCampaignForm({ ...campaignForm, anonymousResponses: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`h-6 w-11 rounded-full transition ${campaignForm.anonymousResponses ? 'bg-primary' : 'bg-dark-border'}`}>
                      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${campaignForm.anonymousResponses ? 'left-[22px]' : 'left-0.5'}`} />
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Step 4: Scheduling & Automation */}
          {wizardStep === 4 && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-dark-border bg-dark-card p-6">
                <h3 className="text-lg font-semibold text-dark-text mb-5">Campaign Schedule</h3>
                <div className="grid gap-5 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark-text">Start Date *</label>
                    <input
                      type="date"
                      value={campaignForm.startDate}
                      onChange={(e) => setCampaignForm({ ...campaignForm, startDate: e.target.value })}
                      className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark-text">End Date *</label>
                    <input
                      type="date"
                      value={campaignForm.endDate}
                      onChange={(e) => setCampaignForm({ ...campaignForm, endDate: e.target.value })}
                      className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark-text">Frequency</label>
                    <select
                      value={campaignForm.frequency}
                      onChange={(e) => setCampaignForm({ ...campaignForm, frequency: e.target.value as any })}
                      className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="once">Once</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-dark-border bg-dark-card p-6">
                <h3 className="text-lg font-semibold text-dark-text mb-5">Automation Settings</h3>
                <div className="space-y-3">
                  {[
                    { key: 'autoSendInvites', icon: Mail, label: 'Auto-send Invitations', desc: 'Automatically email participants when campaign starts' },
                    { key: 'sendReminders', icon: Bell, label: 'Send Reminders', desc: 'Nudge participants who haven\'t completed' },
                    { key: 'sendConfirmations', icon: CheckCircle, label: 'Send Confirmations', desc: 'Email confirmation upon completion' },
                  ].map(({ key, icon: Icon, label, desc }) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-dark-border p-4 transition hover:bg-dark-bg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dark-bg">
                          <Icon className="h-5 w-5 text-dark-text-muted" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-dark-text">{label}</p>
                          <p className="text-xs text-dark-text-muted">{desc}</p>
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={campaignForm[key as keyof typeof campaignForm] as boolean}
                          onChange={(e) => setCampaignForm({ ...campaignForm, [key]: e.target.checked })}
                          className="sr-only"
                        />
                        <div className={`h-6 w-11 rounded-full transition ${campaignForm[key as keyof typeof campaignForm] ? 'bg-primary' : 'bg-dark-border'}`}>
                          <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${campaignForm[key as keyof typeof campaignForm] ? 'left-[22px]' : 'left-0.5'}`} />
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          </div>

          {/* Right Sidebar - Summary */}
          <div className="space-y-6">
            {/* Selected Videos Summary */}
            {selectedVideoIds.length > 0 && (
              <div className="rounded-2xl border border-dark-border bg-dark-card p-5 sticky top-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-dark-text">Selected Videos</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedVideoIds([])}
                    className="text-xs text-dark-text-muted hover:text-dark-text transition"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {selectedVideoIds.map((videoId, index) => {
                    const video = availableVideos.find(v => v.id === videoId);
                    if (!video) return null;
                    return (
                      <div key={video.id} className="flex items-center gap-3 rounded-lg bg-dark-bg p-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-medium text-white">
                          {index + 1}
                        </span>
                        <span className="flex-1 truncate text-sm text-dark-text">{video.title}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedVideoIds(prev => prev.filter(id => id !== videoId))}
                          className="p-1 text-dark-text-muted hover:text-red-400 transition"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Summary Card */}
            <div className="rounded-2xl border border-dark-border bg-dark-card p-5">
              <h3 className="text-sm font-semibold text-dark-text mb-4">Campaign Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-dark-text-muted">Name</span>
                  <span className="text-dark-text font-medium truncate max-w-[150px]">
                    {campaignForm.name || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-text-muted">Competencies</span>
                  <span className="text-dark-text font-medium">
                    {campaignForm.targetCompetencies.length}/5
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-text-muted">Videos</span>
                  <span className="text-dark-text font-medium">
                    {selectedVideoIds.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-text-muted">Targeting</span>
                  <span className="text-dark-text font-medium capitalize">
                    {targetingMode === 'all' ? 'Everyone' : targetingMode}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="sticky bottom-6 space-y-3">
              <div className="flex gap-2">
                {wizardStep > 1 && (
                  <button
                    onClick={handlePrevStep}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-dark-border bg-dark-card text-dark-text-muted transition hover:bg-dark-bg hover:text-dark-text"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                {wizardStep < 4 ? (
                  <button
                    onClick={handleNextStep}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="flex flex-1 gap-2">
                    <button
                      onClick={() => handleSaveCampaign({ publish: false })}
                      disabled={isSavingCampaign}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-dark-border bg-dark-card px-4 py-3 text-sm font-semibold text-dark-text transition hover:bg-dark-bg disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      {isSavingCampaign ? 'Saving…' : 'Draft'}
                    </button>
                    <button
                      onClick={() => handleSaveCampaign({ publish: true })}
                      disabled={isSavingCampaign}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
                    >
                      <Play className="h-4 w-4" />
                      {isSavingCampaign ? 'Launching…' : 'Launch'}
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Step Indicator */}
              <div className="flex items-center justify-center gap-2 lg:hidden">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-2 w-2 rounded-full transition ${
                      wizardStep >= step ? 'bg-primary' : 'bg-dark-border'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-dark-text">Campaigns</h1>
          <p className="text-sm text-dark-text-muted mt-1">
            Manage and launch behavioral coaching campaigns
          </p>
        </div>
            <button
              onClick={handleCreateCampaign}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90"
            >
          <Plus size={16} />
              New Campaign
            </button>
      </div>

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

        {campaignsLoading && campaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-dark-border border-t-primary animate-spin" />
          <p className="mt-4 text-sm text-dark-text-muted">Loading campaigns...</p>
          </div>
        )}

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
                    <span>{campaign.completionRate}% complete</span>
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
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    isActive
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

        {/* Search */}
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
      </div>

      {/* Tab Content */}
      {activeTab === 'dicode' && (
        <div>
          {filteredDICodeCampaigns.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDICodeCampaigns.map((campaign) => renderDICodeCampaignCard(campaign))}
            </div>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCampaigns.map((campaign) => renderCampaignCard(campaign))}
            </div>
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

      {/* Template Selection View */}
      {activeTab === 'create' && !showCreateWizard && (
        <div className="space-y-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-dark-card border border-dark-border px-4 py-2 text-sm font-medium text-dark-text-muted mb-6">
              <Plus className="h-4 w-4" />
              New Campaign
            </div>
            <h2 className="text-2xl font-semibold text-dark-text mb-2">How would you like to start?</h2>
            <p className="text-dark-text-muted">Choose a template to get started quickly, or build from scratch</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {campaignTypes.map((template) => {
              const IconComponent = template.iconComponent;
              return (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-dark-border bg-dark-card text-left transition-all hover:shadow-xl hover:border-dark-border/80"
                >
                  {/* Gradient Header */}
                  <div className={`h-24 bg-gradient-to-br ${template.color} p-4 flex items-end shrink-0`}>
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
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="text-sm font-semibold text-dark-text mb-1 group-hover:text-primary transition-colors">{template.name}</h3>
                    <p className="text-xs text-dark-text-muted mb-3 flex-1 line-clamp-2">{template.description}</p>
                      {template.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.skills.slice(0, 2).map((skill) => (
                          <span key={skill.id} className="rounded-md bg-dark-bg px-2 py-0.5 text-[10px] font-medium text-dark-text-muted">
                              {skill.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                  {/* Hover Arrow */}
                  <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 backdrop-blur opacity-0 transition group-hover:opacity-100">
                    <ArrowRight className="h-3.5 w-3.5 text-white" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Campaign Wizard */}
      {activeTab === 'create' && showCreateWizard && (
        <div className="space-y-6">
          {/* Wizard Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setShowCreateWizard(false);
                setEditingCampaignId(null);
              }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-dark-border bg-dark-card text-dark-text-muted transition hover:bg-dark-bg hover:text-dark-text"
            >
                <ArrowLeft className="h-4 w-4" />
            </button>
              <div>
                <h2 className="text-xl font-semibold text-dark-text">
                  {editingCampaignId ? 'Edit Campaign' : 'New Campaign'}
                </h2>
                <p className="text-sm text-dark-text-muted">Step {wizardStep} of 4</p>
              </div>
          </div>

            {/* Progress Steps - Horizontal Pills */}
            <div className="hidden items-center gap-2 lg:flex">
              {[
                { id: 1, label: 'Setup' },
                { id: 2, label: 'Videos' },
                { id: 3, label: 'Audience' },
                { id: 4, label: 'Schedule' },
            ].map((step) => (
                <button
                  key={step.id}
                  onClick={() => {
                    if (step.id < wizardStep) setWizardStep(step.id);
                  }}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    wizardStep === step.id
                      ? 'bg-primary text-white'
                      : wizardStep > step.id
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-dark-card border border-dark-border text-dark-text-muted'
                  }`}
                >
                  {wizardStep > step.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${wizardStep === step.id ? 'bg-white/20' : 'bg-dark-bg'}`}>{step.id}</span>
                  )}
                    {step.label}
                </button>
            ))}
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
            {/* Main Form Column */}
            <div className="space-y-6">

          {/* Step 1: Campaign Setup */}
          {wizardStep === 1 && (
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-dark-text">Campaign name *</label>
                  <input
                    type="text"
                    className="w-full rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-3 text-sm text-dark-text placeholder:text-dark-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g., Q2 Leadership Pulse"
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-dark-text">Program summary *</label>
                  <textarea
                    className="w-full rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-3 text-sm text-dark-text placeholder:text-dark-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-none"
                    placeholder="Why are we running this campaign?"
                    value={campaignForm.description}
                    onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-dark-text">Target competencies (pick 3-5) *</p>
                    <p className="text-xs text-dark-text-muted">Select competencies and pair them with specific skills</p>
                  </div>
                </div>

                {competencyValidationError && (
                  <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {competencyValidationError}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {competencies.map((comp) => {
                    const isSelected = campaignForm.targetCompetencies.includes(comp.name);
                    return (
                      <button
                        key={comp.id}
                        onClick={() => {
                          setCampaignForm({
                            ...campaignForm,
                            targetCompetencies: isSelected
                              ? campaignForm.targetCompetencies.filter(c => c !== comp.name)
                              : [...campaignForm.targetCompetencies, comp.name],
                            selectedSkills: isSelected
                              ? (() => {
                                const { [comp.id]: removed, ...rest } = campaignForm.selectedSkills;
                                return rest;
                              })()
                              : { ...campaignForm.selectedSkills, [comp.id]: [] },
                          });
                          setCompetencyValidationError('');
                        }}
                        type="button"
                        className={`rounded-2xl border px-4 py-3 text-left transition ${isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-sm'
                          : 'border-dark-border/70 text-dark-text hover:border-dark-border'
                          }`}
                      >
                        <p className="text-sm font-semibold">{comp.name}</p>
                        <p className="text-xs text-dark-text-muted">{comp.description}</p>
                      </button>
                    );
                  })}
                </div>

                {campaignForm.targetCompetencies.length > 0 && (
                  <div className="space-y-6 rounded-3xl border border-dark-border/50 bg-dark-bg/40 p-5">
                    <p className="text-sm font-semibold text-dark-text">Skills & behaviors</p>
                    {competencies
                      .filter(comp => campaignForm.targetCompetencies.includes(comp.name))
                      .map((comp) => (
                        <div key={comp.id} className="rounded-2xl border border-dark-border/70 bg-dark-card/90 p-4 shadow-sm">
                          <p className="text-sm font-semibold text-dark-text mb-3">{comp.name}</p>
                          <div className="space-y-2">
                            {comp.skills.map((skill) => {
                              const isSelected = campaignForm.selectedSkills[comp.id]?.includes(skill.id) ?? false;
                              return (
                                <label
                                  key={skill.id}
                                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition cursor-pointer ${isSelected ? 'border-primary bg-primary/10' : 'border-dark-border/70 bg-dark-bg/60 hover:border-dark-border'
                                    }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const currentSkills = campaignForm.selectedSkills[comp.id] || [];
                                      setCampaignForm({
                                        ...campaignForm,
                                        selectedSkills: {
                                          ...campaignForm.selectedSkills,
                                          [comp.id]: e.target.checked
                                            ? [...currentSkills, skill.id]
                                            : currentSkills.filter(id => id !== skill.id),
                                        },
                                      });
                                      setCompetencyValidationError('');
                                    }}
                                    className="mt-1 rounded border-dark-border/70 text-primary focus:ring-primary"
                                  />
                                  <div>
                                    <p className="font-medium text-dark-text">{skill.name}</p>
                                    <p className="text-xs text-dark-text-muted">{skill.description}</p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Step 2: Select Videos */}
          {wizardStep === 2 && (
            <div className="space-y-8">
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold text-dark-text">Attach video modules</p>
                  <p className="text-xs text-dark-text-muted">
                    Choose from your saved library. Selection order sets the learner sequence.
                  </p>
                </div>

                {/* Search and Filters */}
                {availableVideos.length > 0 && (
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-text-muted" />
                      <input
                        type="text"
                        value={videoSearchQuery}
                        onChange={(e) => setVideoSearchQuery(e.target.value)}
                        placeholder="Search videos..."
                        className="w-full rounded-2xl border border-dark-border/70 bg-dark-bg/60 py-2.5 pl-9 pr-3 text-sm text-dark-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      {allVideoCompetencies.length > 0 && (
                        <select
                          value={selectedVideoCompetency}
                          onChange={(e) => setSelectedVideoCompetency(e.target.value)}
                          className="rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-2.5 text-sm text-dark-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="all">All Tags</option>
                          {allVideoCompetencies.map((comp) => (
                            <option key={comp} value={comp}>
                              {comp}
                            </option>
                          ))}
                        </select>
                      )}
                      <select
                        value={videoSortBy}
                        onChange={(e) => setVideoSortBy(e.target.value)}
                        className="rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-2.5 text-sm text-dark-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="date-desc">Newest First</option>
                        <option value="date-asc">Oldest First</option>
                        <option value="title-asc">Title (A-Z)</option>
                        <option value="title-desc">Title (Z-A)</option>
                      </select>
                      {hasActiveVideoFilters && (
                        <button
                          onClick={clearVideoFilters}
                          className="px-4 py-2 text-sm text-dark-text-muted hover:text-dark-text flex items-center gap-2 transition-colors"
                        >
                          <X size={16} />
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {isLoadingVideos ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-dark-text-muted">Loading videos...</div>
                  </div>
                ) : availableVideos.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-dark-border/70 py-12 text-center">
                    <VideoIcon size={48} className="mx-auto text-dark-text-muted mb-4" />
                    <p className="text-dark-text-muted mb-2">No videos available</p>
                    <p className="text-sm text-dark-text-muted">Create videos first to add them to campaigns</p>
                  </div>
                ) : filteredVideos.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-dark-border/70 py-12 text-center">
                    <Search size={48} className="mx-auto text-dark-text-muted mb-4" />
                    <p className="text-dark-text-muted mb-2">No videos match your filters</p>
                    <p className="text-sm text-dark-text-muted">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {filteredVideos.map((video) => {
                      const isSelected = selectedVideoIds.includes(video.id);
                      const selectionIndex = selectedVideoIds.indexOf(video.id);

                      return (
                        <button
                          key={video.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedVideoIds(selectedVideoIds.filter(id => id !== video.id));
                            } else {
                              setSelectedVideoIds([...selectedVideoIds, video.id]);
                            }
                          }}
                          className={`flex gap-4 rounded-2xl border px-4 py-4 text-left transition ${isSelected
                            ? 'border-primary bg-primary/10 shadow-md'
                            : 'border-dark-border/70 bg-dark-bg/60 hover:border-dark-border'
                            }`}
                        >
                          <div className="h-20 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-dark-bg/40">
                            {video.thumbnailUrl ? (
                              <img
                                src={video.thumbnailUrl}
                                alt={video.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-dark-text-muted">
                                <VideoIcon className="h-6 w-6" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="line-clamp-1 text-base font-semibold text-dark-text">
                                {video.title}
                              </p>
                              {isSelected && (
                                <span className="px-2 py-0.5 bg-primary text-dark-bg rounded-full text-xs font-medium">
                                  #{selectionIndex + 1}
                                </span>
                              )}
                            </div>
                            {video.description && (
                              <p className="text-sm text-dark-text-muted line-clamp-2 mb-2">{video.description}</p>
                            )}
                            <div className="flex flex-wrap gap-2 text-xs text-dark-text-muted">
                              {video.duration && video.duration > 0 && (
                                <span>{formatDuration(video.duration)}</span>
                              )}
                              <span>• {new Date(video.metadata.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Videos Order */}
              {selectedVideoIds.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-3">
                    Selected Videos ({selectedVideoIds.length}) - Drag to reorder
                  </label>
                  <div className="space-y-2">
                    {selectedVideoIds.map((videoId, index) => {
                      const video = availableVideos.find(v => v.id === videoId);
                      if (!video) return null;

                      return (
                        <div key={videoId} className="card bg-dark-bg flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <GripVertical size={18} className="text-dark-text-muted cursor-move" />
                            <span className="text-sm font-semibold text-primary w-6">
                              #{index + 1}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-dark-text truncate">
                              {video.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (index > 0) {
                                  const newOrder = [...selectedVideoIds];
                                  [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                                  setSelectedVideoIds(newOrder);
                                }
                              }}
                              disabled={index === 0}
                              className="p-1 hover:bg-dark-card rounded disabled:opacity-30"
                              title="Move up"
                            >
                              <ChevronUp size={16} className="text-dark-text" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (index < selectedVideoIds.length - 1) {
                                  const newOrder = [...selectedVideoIds];
                                  [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                                  setSelectedVideoIds(newOrder);
                                }
                              }}
                              disabled={index === selectedVideoIds.length - 1}
                              className="p-1 hover:bg-dark-card rounded disabled:opacity-30"
                              title="Move down"
                            >
                              <ChevronDown size={16} className="text-dark-text" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVideoIds(selectedVideoIds.filter(id => id !== videoId));
                              }}
                              className="p-1 hover:bg-red-500/10 rounded text-red-500"
                              title="Remove"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Step 3: Audience Management */}
          {wizardStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-dark-text mb-4">Audience Management</h3>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-dark-text mb-3">Targeting Mode</label>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {targetingOptions.map((option) => {
                        const isActive = targetingMode === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleTargetingModeChange(option.id)}
                            className={`rounded-2xl border px-4 py-3 text-left transition-colors ${isActive ? 'border-primary bg-primary/10 text-dark-text' : 'border-dark-border/60 text-dark-text-muted hover:border-dark-border'
                              }`}
                          >
                            <div className="text-sm font-semibold">{option.label}</div>
                            <p className="text-xs text-dark-text-muted mt-1">{option.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-dark-border/60 bg-dark-bg/70 px-5 py-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-dark-text-muted">Eligible Audience</p>
                      <p className="text-2xl font-semibold text-dark-text mt-1">{currentEligibleCount}</p>
                    </div>
                    <p className="text-xs text-dark-text-muted text-right">
                      Employees who can access this campaign based on the targeting rules above
                    </p>
                  </div>

                  {targetingMode === 'all' && (
                    <div className="card border-dashed text-sm text-dark-text-muted">
                      Every employee in your organization will receive access to this campaign once it launches.
                    </div>
                  )}

                  {targetingMode === 'departments' && (
                    <div>
                      <label className="block text-sm font-medium text-dark-text mb-3">Choose Departments</label>
                      {uniqueDepartments.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {uniqueDepartments.map((dept) => {
                            const isSelected = campaignForm.allowedDepartments.includes(dept);
                            return (
                              <button
                                key={dept}
                                type="button"
                                onClick={() => toggleDepartmentSelection(dept)}
                                className={`rounded-full px-4 py-1 text-sm border transition-colors ${isSelected
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-dark-border text-dark-text-muted hover:border-primary/50'
                                  }`}
                              >
                                {dept}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-dark-text-muted">
                          No departments found. Add department metadata to employees to enable department targeting.
                        </p>
                      )}
                    </div>
                  )}

                  {targetingMode === 'cohorts' && (
                    <div>
                      <label className="block text-sm font-medium text-dark-text mb-3">Choose Cohorts</label>
                      {availableCohorts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {availableCohorts.map((cohort) => {
                            const isSelected = campaignForm.allowedCohortIds.includes(cohort.id);
                            return (
                              <button
                                key={cohort.id}
                                type="button"
                                onClick={() => toggleCohortSelection(cohort.id)}
                                className={`rounded-2xl border px-4 py-3 text-left transition-colors ${isSelected
                                  ? 'border-primary bg-primary/10 text-dark-text'
                                  : 'border-dark-border/70 text-dark-text-muted hover:border-dark-border'
                                  }`}
                              >
                                <div className="text-sm font-semibold text-dark-text">{cohort.name}</div>
                                <p className="text-xs text-dark-text-muted">
                                  {cohort.employeeIds.length} member{cohort.employeeIds.length === 1 ? '' : 's'}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-dark-text-muted">
                          No cohorts available. Create cohorts from the Employee Management page first.
                        </p>
                      )}
                    </div>
                  )}

                  {targetingMode === 'employees' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-dark-text mb-3">
                          Select Employees
                        </label>
                        <div className="mb-4 space-y-3">
                          <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-muted" />
                            <input
                              type="text"
                              placeholder="Search employees by name, email, or department..."
                              value={employeeSearchTerm}
                              onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                              className="input w-full pl-10"
                            />
                          </div>

                          <div className="grid grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs text-dark-text-muted mb-1">Department</label>
                              <select
                                className="input w-full text-sm"
                                value={employeeDepartmentFilter}
                                onChange={(e) => setEmployeeDepartmentFilter(e.target.value)}
                              >
                                <option value="all">All Departments</option>
                                {uniqueDepartments.map((dept) => (
                                  <option key={dept} value={dept}>{dept}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-dark-text-muted mb-1">
                                Role
                                <span className="text-[10px] ml-1 opacity-50">(Coming Soon)</span>
                              </label>
                              <select
                                className="input w-full text-sm opacity-50 cursor-not-allowed"
                                value={employeeRoleFilter}
                                onChange={(e) => setEmployeeRoleFilter(e.target.value)}
                                disabled
                              >
                                <option value="all">All Roles</option>
                                <option value="manager">Manager</option>
                                <option value="senior-manager">Senior Manager</option>
                                <option value="director">Director</option>
                                <option value="senior-director">Senior Director</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-dark-text-muted mb-1">
                                Region
                                <span className="text-[10px] ml-1 opacity-50">(Coming Soon)</span>
                              </label>
                              <select
                                className="input w-full text-sm opacity-50 cursor-not-allowed"
                                value={employeeRegionFilter}
                                onChange={(e) => setEmployeeRegionFilter(e.target.value)}
                                disabled
                              >
                                <option value="all">All Regions</option>
                                <option value="north-america">North America</option>
                                <option value="europe">Europe</option>
                                <option value="asia-pacific">Asia Pacific</option>
                                <option value="latin-america">Latin America</option>
                                <option value="middle-east-africa">Middle East & Africa</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-dark-text-muted mb-1">Cohort</label>
                              <select
                                className="input w-full text-sm"
                                value={employeeCohortFilter}
                                onChange={(e) => {
                                  setEmployeeCohortFilter(e.target.value);
                                  setCampaignForm({ ...campaignForm, cohortGroup: e.target.value === 'all' ? '' : e.target.value });
                                }}
                              >
                                <option value="all">All Cohorts</option>
                                {availableCohorts.map((cohort) => (
                                  <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="border border-dark-border rounded-lg max-h-96 overflow-y-auto">
                          {availableEmployees
                            .filter(emp => {
                              if (emp.status !== 'active') return false;
                              if (employeeSearchTerm !== '') {
                                const searchLower = employeeSearchTerm.toLowerCase();
                                if (!emp.name.toLowerCase().includes(searchLower) &&
                                  !emp.email.toLowerCase().includes(searchLower) &&
                                  !emp.department?.toLowerCase().includes(searchLower)) {
                                  return false;
                                }
                              }
                              if (employeeDepartmentFilter !== 'all' && emp.department !== employeeDepartmentFilter) {
                                return false;
                              }
                              if (employeeCohortFilter !== 'all') {
                                if (!emp.cohortIds || !emp.cohortIds.includes(employeeCohortFilter)) {
                                  return false;
                                }
                              }
                              return true;
                            })
                            .map((employee) => {
                              const isSelected = selectedEmployeeIds.includes(employee.id);
                              return (
                                <label
                                  key={employee.id}
                                  className="flex items-center gap-3 p-3 border-b border-dark-border last:border-b-0 cursor-pointer hover:bg-dark-bg transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedEmployeeIds([...selectedEmployeeIds, employee.id]);
                                      } else {
                                        setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== employee.id));
                                      }
                                    }}
                                    className="w-4 h-4 rounded border-dark-border text-primary focus:ring-primary"
                                  />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-dark-text">{employee.name}</div>
                                    <div className="text-xs text-dark-text-muted">{employee.email}</div>
                                    {employee.department && (
                                      <div className="text-xs text-dark-text-muted mt-1">{employee.department}</div>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                        </div>
                        {selectedEmployeeIds.length > 0 && (
                          <p className="text-sm text-dark-text-muted mt-3">
                            {selectedEmployeeIds.length} employee{selectedEmployeeIds.length !== 1 ? 's' : ''} selected
                          </p>
                        )}
                      </div>

                      {campaignForm.participants.length > 0 ? (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-medium text-dark-text">
                              Participants ({campaignForm.participants.length})
                            </label>
                            <button
                              onClick={() => setShowEditParticipantsModal(true)}
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                            >
                              <Edit size={14} />
                              Edit Participants
                            </button>
                          </div>
                          <div className="border border-dark-border rounded-lg overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-dark-bg">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-text-muted">Name</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-text-muted">Email</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-text-muted">Department</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-text-muted">Role</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-text-muted">Region</th>
                                </tr>
                              </thead>
                              <tbody>
                                {campaignForm.participants.slice(0, 5).map((p) => (
                                  <tr key={p.id} className="border-t border-dark-border">
                                    <td className="px-4 py-3 text-sm text-dark-text">{p.name}</td>
                                    <td className="px-4 py-3 text-sm text-dark-text-muted">{p.email}</td>
                                    <td className="px-4 py-3 text-sm text-dark-text-muted">{p.department}</td>
                                    <td className="px-4 py-3 text-sm text-dark-text-muted">{p.role}</td>
                                    <td className="px-4 py-3 text-sm text-dark-text-muted">{p.region}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {campaignForm.participants.length > 5 && (
                              <div className="px-4 py-3 bg-dark-bg text-sm text-dark-text-muted text-center">
                                +{campaignForm.participants.length - 5} more participants
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="card text-center py-8 border-dashed">
                          <Users size={40} className="text-dark-text-muted mx-auto mb-3" />
                          <p className="text-dark-text-muted">No employees selected yet</p>
                          <p className="text-sm text-dark-text-muted mt-2">Select employees from the list above to add them as participants</p>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center justify-between p-4 bg-dark-bg rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-dark-text mb-1">
                        Anonymous Responses
                      </label>
                      <p className="text-xs text-dark-text-muted">
                        Hide participant identities in response data
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={campaignForm.anonymousResponses}
                        onChange={(e) => setCampaignForm({ ...campaignForm, anonymousResponses: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Step 4: Scheduling & Automation */}
          {wizardStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-dark-text mb-4">Scheduling & Automation</h3>

                <div className="space-y-6">
                  {/* Date Pickers */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-text mb-2">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        className="input w-full"
                        value={campaignForm.startDate}
                        onChange={(e) => setCampaignForm({ ...campaignForm, startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark-text mb-2">
                        End Date *
                      </label>
                      <input
                        type="date"
                        className="input w-full"
                        value={campaignForm.endDate}
                        onChange={(e) => setCampaignForm({ ...campaignForm, endDate: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Frequency */}
                  <div>
                    <label className="block text-sm font-medium text-dark-text mb-2">
                      Frequency
                    </label>
                    <select
                      className="input w-full"
                      value={campaignForm.frequency}
                      onChange={(e) => setCampaignForm({ ...campaignForm, frequency: e.target.value as any })}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </div>

                  {/* One-time Access */}
                  <div className="flex items-center justify-between p-4 bg-dark-bg rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-dark-text mb-1">
                        One-time access per content per user
                      </label>
                      <p className="text-xs text-dark-text-muted">
                        Users can only access each content item once
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={campaignForm.oneTimeAccess}
                        onChange={(e) => setCampaignForm({ ...campaignForm, oneTimeAccess: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {/* Automation Toggles */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-dark-text">Automation Settings</h4>

                    <div className="flex items-center justify-between p-4 bg-dark-bg rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mail size={20} className="text-primary" />
                        <div>
                          <label className="block text-sm font-medium text-dark-text">
                            Auto-send Email Invitations
                          </label>
                          <p className="text-xs text-dark-text-muted">
                            Automatically send invitations when campaign starts
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={campaignForm.autoSendInvites}
                          onChange={(e) => setCampaignForm({ ...campaignForm, autoSendInvites: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-dark-bg rounded-lg">
                      <div className="flex items-center gap-3">
                        <Bell size={20} className="text-primary" />
                        <div>
                          <label className="block text-sm font-medium text-dark-text">
                            Send Reminders for Non-Respondents
                          </label>
                          <p className="text-xs text-dark-text-muted">
                            Automatically remind participants who haven't responded
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={campaignForm.sendReminders}
                          onChange={(e) => setCampaignForm({ ...campaignForm, sendReminders: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-dark-bg rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle size={20} className="text-primary" />
                        <div>
                          <label className="block text-sm font-medium text-dark-text">
                            Send Completion Confirmations
                          </label>
                          <p className="text-xs text-dark-text-muted">
                            Send confirmation emails when participants complete the campaign
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={campaignForm.sendConfirmations}
                          onChange={(e) => setCampaignForm({ ...campaignForm, sendConfirmations: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
            </div>

            {/* Right Sidebar - Summary */}
            <div className="space-y-6">
              {/* Selected Videos Summary */}
              {selectedVideoIds.length > 0 && (
                <div className="rounded-2xl border border-dark-border bg-dark-card p-5 sticky top-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-dark-text">Selected Videos</h3>
                    <button
                      type="button"
                      onClick={() => setSelectedVideoIds([])}
                      className="text-xs text-dark-text-muted hover:text-dark-text transition"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {selectedVideoIds.map((videoId, index) => {
                      const video = availableVideos.find(v => v.id === videoId);
                      if (!video) return null;
                      return (
                        <div key={video.id} className="flex items-center gap-3 rounded-lg bg-dark-bg p-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-medium text-white">
                            {index + 1}
                          </span>
                          <span className="flex-1 truncate text-sm text-dark-text">{video.title}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedVideoIds(prev => prev.filter(id => id !== videoId))}
                            className="p-1 text-dark-text-muted hover:text-red-400 transition"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Summary Card */}
              <div className="rounded-2xl border border-dark-border bg-dark-card p-5">
                <h3 className="text-sm font-semibold text-dark-text mb-4">Campaign Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted">Name</span>
                    <span className="text-dark-text font-medium truncate max-w-[150px]">
                      {campaignForm.name || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted">Competencies</span>
                    <span className="text-dark-text font-medium">
                      {campaignForm.targetCompetencies.length}/5
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted">Videos</span>
                    <span className="text-dark-text font-medium">
                      {selectedVideoIds.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted">Targeting</span>
                    <span className="text-dark-text font-medium capitalize">
                      {targetingMode === 'all' ? 'Everyone' : targetingMode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="sticky bottom-6 space-y-3">
                <div className="flex gap-2">
                  {wizardStep > 1 && (
                <button
                  onClick={handlePrevStep}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-dark-border bg-dark-card text-dark-text-muted transition hover:bg-dark-bg hover:text-dark-text"
                >
                      <ArrowLeft className="h-4 w-4" />
                </button>
                  )}
                  {wizardStep < 4 ? (
                  <button
                      onClick={handleNextStep}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <div className="flex flex-1 gap-2">
                      <button
                        onClick={() => handleSaveCampaign({ publish: false })}
                    disabled={isSavingCampaign}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-dark-border bg-dark-card px-4 py-3 text-sm font-semibold text-dark-text transition hover:bg-dark-bg disabled:opacity-60"
                  >
                        <Save className="h-4 w-4" />
                        {isSavingCampaign ? 'Saving…' : 'Draft'}
                  </button>
                  <button
                        onClick={() => handleSaveCampaign({ publish: true })}
                        disabled={isSavingCampaign}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
                      >
                        <Play className="h-4 w-4" />
                        {isSavingCampaign ? 'Launching…' : 'Launch'}
                  </button>
                </div>
                  )}
              </div>

                {/* Mobile Step Indicator */}
                <div className="flex items-center justify-center gap-2 lg:hidden">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-2 w-2 rounded-full transition ${
                        wizardStep >= step ? 'bg-primary' : 'bg-dark-border'
                      }`}
                    />
                  ))}
            </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Assessment & Data Collection View for Existing Campaigns */}
      {viewingCampaignId && (() => {
        const campaign = campaigns.find(c => c.id === viewingCampaignId);
        if (!campaign) return null;

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-dark-card w-full max-w-4xl rounded-lg shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="sticky top-0 bg-dark-card border-b border-dark-border p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-dark-text">Assessment & Data Collection</h2>
                  <p className="text-sm text-dark-text-muted mt-1">{campaign.name}</p>
                </div>
                <button
                  onClick={() => setViewingCampaignId(null)}
                  className="p-2 hover:bg-dark-bg rounded-lg transition-colors"
                >
                  <X size={20} className="text-dark-text" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Response Tracker */}
                <div className="card bg-dark-bg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-dark-text">Real-time Response Tracker</h4>
                    <span className="text-xs text-dark-text-muted">Live</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-dark-text">Response Rate</span>
                        <span className="text-sm font-semibold text-dark-text">{campaign.completionRate}%</span>
                      </div>
                      <div className="w-full bg-dark-border rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${campaign.completionRate}%` }}></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-dark-text">{campaign.totalResponses}</div>
                        <div className="text-xs text-dark-text-muted">Total Responses</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-dark-text">{Math.round(campaign.totalResponses * (campaign.completionRate / 100))}</div>
                        <div className="text-xs text-dark-text-muted">Completed</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-dark-text">{Math.round(campaign.totalResponses * (1 - campaign.completionRate / 100))}</div>
                        <div className="text-xs text-dark-text-muted">Pending</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Edit Participants */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-dark-text">
                      Manage Participants
                    </label>
                    <button
                      onClick={() => setShowEditParticipantsModal(true)}
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <Edit size={14} />
                      Edit Participants
                    </button>
                  </div>
                  <p className="text-sm text-dark-text-muted mb-4">
                    You can add or remove participants even after the campaign has started.
                  </p>
                </div>

                {/* Campaign Usage - Randomized Sets */}
                {campaign.campaignType === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-dark-text mb-3">
                      Advanced Options
                    </label>
                    <div className="p-4 bg-dark-bg rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <label className="block text-sm font-medium text-dark-text mb-1">
                            Randomized Video Sets
                          </label>
                          <p className="text-xs text-dark-text-muted">
                            Randomly assign one video set per activation (e.g., Program A has 3 sets)
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs text-dark-text-muted mb-2">Number of Sets</label>
                        <input
                          type="number"
                          className="input w-full"
                          placeholder="3"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Import Participants Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card w-full max-w-2xl rounded-lg shadow-xl">
            <div className="p-6 border-b border-dark-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-dark-text">Import Participants</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 hover:bg-dark-bg rounded-lg transition-colors"
              >
                <X size={20} className="text-dark-text" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-dark-text-muted">
                Select an import method to add participants to your campaign.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    alert('CSV upload feature coming soon');
                  }}
                  className="p-6 bg-dark-bg rounded-lg border border-dark-border hover:border-primary transition-colors text-center"
                >
                  <Upload size={32} className="text-primary mx-auto mb-3" />
                  <div className="font-medium text-dark-text">Upload CSV</div>
                  <div className="text-xs text-dark-text-muted mt-1">Import from file</div>
                </button>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    alert('HRIS sync feature coming soon');
                  }}
                  className="p-6 bg-dark-bg rounded-lg border border-dark-border hover:border-primary transition-colors text-center"
                >
                  <Users size={32} className="text-primary mx-auto mb-3" />
                  <div className="font-medium text-dark-text">Sync HRIS</div>
                  <div className="text-xs text-dark-text-muted mt-1">Connect to HR system</div>
                </button>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                  }}
                  className="p-6 bg-dark-bg rounded-lg border border-dark-border hover:border-primary transition-colors text-center"
                >
                  <Plus size={32} className="text-primary mx-auto mb-3" />
                  <div className="font-medium text-dark-text">Manual Add</div>
                  <div className="text-xs text-dark-text-muted mt-1">Select from employee list</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Participants Modal */}
      {showEditParticipantsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card w-full max-w-4xl rounded-lg shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-6 border-b border-dark-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-dark-text">Edit Participants</h2>
              <button
                onClick={() => setShowEditParticipantsModal(false)}
                className="p-2 hover:bg-dark-bg rounded-lg transition-colors"
              >
                <X size={20} className="text-dark-text" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-dark-text-muted">
                  {campaignForm.participants.length} participants
                </p>
                <button
                  onClick={() => {
                    setShowEditParticipantsModal(false);
                  }}
                  className="btn-secondary flex items-center gap-2"
                >
                  <X size={18} />
                  Close
                </button>
              </div>
              <div className="border border-dark-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-dark-bg">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-dark-text-muted">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-dark-text-muted">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-dark-text-muted">Department</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-dark-text-muted">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-dark-text-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignForm.participants.map((p) => (
                      <tr key={p.id} className="border-t border-dark-border">
                        <td className="px-4 py-3 text-sm text-dark-text">{p.name}</td>
                        <td className="px-4 py-3 text-sm text-dark-text-muted">{p.email}</td>
                        <td className="px-4 py-3 text-sm text-dark-text-muted">{p.department}</td>
                        <td className="px-4 py-3 text-sm text-dark-text-muted">{p.role}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setCampaignForm({
                                ...campaignForm,
                                participants: campaignForm.participants.filter(part => part.id !== p.id),
                              });
                            }}
                            className="text-red-500 hover:text-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 border-t border-dark-border flex justify-end">
              <button
                onClick={() => setShowEditParticipantsModal(false)}
                className="btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignManagement;