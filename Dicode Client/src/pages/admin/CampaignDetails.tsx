import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  Target,
  Video as VideoIcon,
  Play,
  Pause,
  Edit,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Clock,
  BarChart3,
  MessageCircle,
  User,
  Eye,
  HelpCircle,
  Megaphone,
  Filter,
  TrendingUp,
  ArrowLeft,
  Settings,
  MoreVertical,
  Copy,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Skeleton } from '@/components/shared/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCampaign,
  getCampaignEnrollments,
  getCampaignResponses,
  getUsersByOrganization,
  getVideo,
  updateCampaign,
  getOrganization,
  getCohortsByOrganization,
  deleteCampaign,
} from '@/lib/firestore';
import type { SkillAssessment } from '@/types';
import type { Campaign as FirestoreCampaign, CampaignEnrollment, Video, Question, Cohort } from '@/types';
import { getCompetencyById, getSkillById } from '@/lib/competencies';
import { useCampaignAnalytics } from '@/hooks/useCampaignAnalytics';

interface SJTAnswer {
  selectedOptionId: string;
  intentScore: number;
}

interface CampaignResponse {
  id: string;
  campaignId: string;
  videoId: string;
  questionId: string;
  userId: string;
  organizationId?: string;
  answer: string | number | boolean | SJTAnswer;
  answeredAt: Date | string | number;
  metadata?: any;
  intentScore?: number; // For Q2 responses
}

interface ParticipantData {
  userId: string;
  userName: string;
  userEmail: string;
  enrollment: CampaignEnrollment;
  responses: CampaignResponse[];
  completionRate: number;
}

const AdminCampaignDetails = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Data states
  const [campaign, setCampaign] = useState<FirestoreCampaign | null>(null);
  const [videos, setVideos] = useState<Record<string, Video>>({});
  const [enrollments, setEnrollments] = useState<CampaignEnrollment[]>([]);
  const [responses, setResponses] = useState<CampaignResponse[]>([]);
  const [orgUsers, setOrgUsers] = useState<Record<string, { name: string; email: string; department?: string; cohortIds?: string[] }>>({});
  const [departments, setDepartments] = useState<string[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);

  // Filter states
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');

  // Analytics from Cloud Function (for Analytics tab)
  const { analytics, isLoading: analyticsLoading, fetchAnalytics } = useCampaignAnalytics();

  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'responses' | 'settings'>('overview');
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Navigation items
  const NAV_ITEMS = [
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'participants', label: 'Participants', icon: Users },
    { id: 'responses', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Fetch campaign data
  useEffect(() => {
    if (!campaignId || !user?.organization) {
      setLoading(false);
      return;
    }

    const orgId = user.organization;
    const fetchData = async () => {
      try {
        // Fetch campaign
        const campaignData = await getCampaign(campaignId);
        if (!campaignData) {
          setError('Campaign not found');
          setLoading(false);
          return;
        }
        setCampaign(campaignData);

        // Fetch videos for campaign items
        const videoMap: Record<string, Video> = {};
        for (const item of campaignData.items || []) {
          try {
            const video = await getVideo(item.videoId);
            if (video) {
              videoMap[item.videoId] = video;
            }
          } catch (err) {
            console.warn('Failed to fetch video:', item.videoId, err);
          }
        }
        setVideos(videoMap);

        // Fetch enrollments for this campaign (filtered by org at query level)
        const campaignEnrollments = await getCampaignEnrollments(campaignId, orgId);
        setEnrollments(campaignEnrollments);

        // Fetch responses for this campaign (filtered by org)
        const campaignResponses = await getCampaignResponses(campaignId, orgId);
        setResponses(campaignResponses);

        // Fetch org users for name/email lookup (with department and cohortIds)
        const users = await getUsersByOrganization(orgId);
        const userMap: Record<string, { name: string; email: string; department?: string; cohortIds?: string[] }> = {};
        users.forEach((u) => {
          userMap[u.id] = {
            name: u.name || 'Unknown',
            email: u.email || '',
            department: u.department || undefined,
            cohortIds: u.cohortIds || undefined,
          };
        });
        setOrgUsers(userMap);

        // Fetch organization for departments
        const org = await getOrganization(orgId);
        if (org) {
          setDepartments(org.departments || []);
        }

        // Fetch cohorts
        const orgCohorts = await getCohortsByOrganization(orgId);
        setCohorts(orgCohorts);
      } catch (err) {
        console.error('Failed to load campaign details:', err);
        setError('Failed to load campaign details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [campaignId, user?.organization]);

  // Fetch analytics from Cloud Function when campaign/filters change
  useEffect(() => {
    if (!campaignId || !user?.organization) return;
    fetchAnalytics(
      campaignId,
      user.organization,
      selectedDepartment !== 'all' ? selectedDepartment : undefined,
      selectedCohort !== 'all' ? selectedCohort : undefined
    );
  }, [campaignId, user?.organization, selectedDepartment, selectedCohort, fetchAnalytics]);

  // Computed values
  const totalQuestions = useMemo(() => {
    if (campaign?.metadata?.computed?.totalQuestions !== undefined) {
      return campaign.metadata.computed.totalQuestions;
    }
    return Object.values(videos).reduce((sum, video) => sum + (video.questions?.length || 0), 0);
  }, [campaign, videos]);

  const totalVideos = campaign?.metadata?.computed?.totalItems ?? campaign?.items?.length ?? Object.keys(videos).length;

  const participantData = useMemo((): ParticipantData[] => {
    return enrollments.map((enrollment) => {
      const userResponses = responses.filter((r) => r.userId === enrollment.userId);
      const completionRate = totalQuestions > 0
        ? Math.round((userResponses.length / totalQuestions) * 100)
        : 0;

      return {
        userId: enrollment.userId,
        userName: orgUsers[enrollment.userId]?.name || 'Unknown User',
        userEmail: orgUsers[enrollment.userId]?.email || '',
        enrollment,
        responses: userResponses,
        completionRate,
      };
    });
  }, [enrollments, responses, orgUsers, totalQuestions]);

  const stats = useMemo(() => {
    const enrolled = enrollments.length;
    const completed = enrollments.filter((e) => e.status === 'completed').length;
    const inProgress = enrollments.filter((e) => e.status === 'in-progress').length;
    const avgCompletion = participantData.length > 0
      ? Math.round(participantData.reduce((sum, p) => sum + p.completionRate, 0) / participantData.length)
      : 0;
    const totalResponsesCount = responses.length;

    return { enrolled, completed, inProgress, avgCompletion, totalResponsesCount };
  }, [enrollments, participantData, responses]);

  // Filtered responses based on department/cohort selection
  const filteredResponses = useMemo(() => {
    if (selectedDepartment === 'all' && selectedCohort === 'all') {
      return responses;
    }

    const matchingUserIds = new Set(
      Object.entries(orgUsers)
        .filter(([, userData]) => {
          const matchesDept = selectedDepartment === 'all' || userData.department === selectedDepartment;
          const matchesCohort = selectedCohort === 'all' || userData.cohortIds?.includes(selectedCohort);
          return matchesDept && matchesCohort;
        })
        .map(([userId]) => userId)
    );

    return responses.filter(r => matchingUserIds.has(r.userId));
  }, [responses, selectedDepartment, selectedCohort, orgUsers]);

  // Filtered enrollments based on department/cohort selection
  const filteredEnrollments = useMemo(() => {
    if (selectedDepartment === 'all' && selectedCohort === 'all') {
      return enrollments;
    }

    return enrollments.filter(e => {
      const userData = orgUsers[e.userId];
      if (!userData) return false;
      const matchesDept = selectedDepartment === 'all' || userData.department === selectedDepartment;
      const matchesCohort = selectedCohort === 'all' || userData.cohortIds?.includes(selectedCohort);
      return matchesDept && matchesCohort;
    });
  }, [enrollments, selectedDepartment, selectedCohort, orgUsers]);

  // Filtered participant data
  const filteredParticipantData = useMemo((): ParticipantData[] => {
    if (selectedDepartment === 'all' && selectedCohort === 'all') {
      return participantData;
    }
    return participantData.filter(p => {
      const userData = orgUsers[p.userId];
      if (!userData) return false;
      const matchesDept = selectedDepartment === 'all' || userData.department === selectedDepartment;
      const matchesCohort = selectedCohort === 'all' || userData.cohortIds?.includes(selectedCohort);
      return matchesDept && matchesCohort;
    });
  }, [participantData, selectedDepartment, selectedCohort, orgUsers]);

  // Filtered stats
  const filteredStats = useMemo(() => {
    const enrolled = filteredEnrollments.length;
    const completed = filteredEnrollments.filter((e) => e.status === 'completed').length;
    const inProgress = filteredEnrollments.filter((e) => e.status === 'in-progress').length;
    const avgCompletion = filteredParticipantData.length > 0
      ? Math.round(filteredParticipantData.reduce((sum, p) => sum + p.completionRate, 0) / filteredParticipantData.length)
      : 0;
    const totalResponsesCount = filteredResponses.length;

    return { enrolled, completed, inProgress, avgCompletion, totalResponsesCount };
  }, [filteredEnrollments, filteredParticipantData, filteredResponses]);

  // Check if filters are active
  const isFiltered = selectedDepartment !== 'all' || selectedCohort !== 'all';

  // Video-level aggregates from Cloud Function
  const videoAggregates = useMemo(() => {
    if (!analytics?.videoAggregates) return [];
    return analytics.videoAggregates;
  }, [analytics]);




  // Skill-level aggregates from Cloud Function
  const skillAggregates = useMemo(() => {
    if (!analytics?.skillAggregates) return [];

    return analytics.skillAggregates.map(skill => {
      const skillDef = getSkillById(skill.skillId);
      const competencyId = skillDef?.competencyId || '';
      const competency = getCompetencyById(competencyId);

      return {
        skillId: skill.skillId,
        skillName: skillDef?.name || skill.skillName || skill.skillId,
        competencyId,
        competencyName: competency?.name || 'Unknown Competency',
        avgScore: skill.avgScore,
        assessmentCount: skill.count
      };
    });
  }, [analytics]);

  const formatDate = (date: Date | string | number | { toDate?: () => Date } | undefined | null) => {
    if (!date) return '—';

    let parsedDate: Date;

    if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
      parsedDate = date.toDate();
    } else if (typeof date === 'string') {
      parsedDate = new Date(date);
    } else if (typeof date === 'number') {
      parsedDate = new Date(date);
    } else if (date instanceof Date) {
      parsedDate = date;
    } else {
      return '—';
    }

    if (isNaN(parsedDate.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parsedDate);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' };
      case 'draft':
        return { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' };
      case 'completed':
        return { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' };
      default:
        return { bg: 'bg-white/5', text: 'text-white/50', dot: 'bg-white/50' };
    }
  };

  const getEnrollmentStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: 'bg-emerald-500/10', text: 'text-emerald-400' };
      case 'in-progress':
        return { bg: 'bg-blue-500/10', text: 'text-blue-400' };
      case 'not-started':
        return { bg: 'bg-white/5', text: 'text-white/50' };
      default:
        return { bg: 'bg-white/5', text: 'text-white/50' };
    }
  };

  const getCampaignStatus = (c: FirestoreCampaign | null): 'active' | 'draft' | 'completed' => {
    if (!c) return 'draft';
    return c.metadata?.isPublished ? 'active' : 'draft';
  };

  const campaignStatus = getCampaignStatus(campaign);
  const statusConfig = getStatusConfig(campaignStatus);

  const handleTogglePublish = async () => {
    if (!campaign) return;
    setPublishing(true);
    try {
      const newPublishedState = !campaign.metadata?.isPublished;
      await updateCampaign(campaign.id, {
        metadata: {
          ...campaign.metadata,
          isPublished: newPublishedState
        }
      } as any);
      setCampaign({
        ...campaign,
        metadata: {
          ...campaign.metadata,
          isPublished: newPublishedState
        }
      });
    } catch (err) {
      console.error('Failed to update campaign status:', err);
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaignId) return;
    setDeleting(true);
    try {
      await deleteCampaign(campaignId);
      navigate('/admin/campaigns');
    } catch (err) {
      console.error('Failed to delete campaign:', err);
      setError('Failed to delete campaign');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        // Use filtered stats when filters are active
        const displayStats = isFiltered ? filteredStats : stats;
        return (
          <div className="space-y-8">
            {/* Filters */}
            {(departments.length > 0 || cohorts.length > 0) && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Filter size={14} />
                  <span>Filter:</span>
                </div>
                {departments.length > 0 && (
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-white/20"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                )}
                {cohorts.length > 0 && (
                  <select
                    value={selectedCohort}
                    onChange={(e) => setSelectedCohort(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-white/20"
                  >
                    <option value="all">All Cohorts</option>
                    {cohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
                    ))}
                  </select>
                )}
                {isFiltered && (
                  <button
                    onClick={() => {
                      setSelectedDepartment('all');
                      setSelectedCohort('all');
                    }}
                    className="text-xs text-white/50 hover:text-white transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* Stats Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Performance Stats</p>
                {isFiltered && (
                  <span className="text-xs text-white/40">Showing filtered results</span>
                )}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="text-white/40" size={18} />
                    <span className="text-xs text-white/50 uppercase tracking-wider">Enrolled</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{displayStats.enrolled}</div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <Check className="text-white/40" size={18} />
                    <span className="text-xs text-white/50 uppercase tracking-wider">Completed</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">{displayStats.completed}</div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="text-white/40" size={18} />
                    <span className="text-xs text-white/50 uppercase tracking-wider">Avg Progress</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{displayStats.avgCompletion}%</div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <MessageCircle className="text-white/40" size={18} />
                    <span className="text-xs text-white/50 uppercase tracking-wider">Responses</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{displayStats.totalResponsesCount}</div>
                </div>
              </div>
            </div>

            {/* Schedule & Info */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-4">Campaign Info</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Schedule */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-white/50 uppercase tracking-wide">Schedule</p>
                      <p className="text-sm font-medium text-white capitalize">{campaign?.schedule?.frequency || 'Once'}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/50">Start</span>
                      <span className="text-white">{formatDate(campaign?.schedule?.startDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">End</span>
                      <span className="text-white">{formatDate(campaign?.schedule?.endDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Skill Focus */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Target className="h-5 w-5 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs text-white/50 uppercase tracking-wide">Skill Focus</p>
                      <p className="text-sm font-medium text-white">{campaign?.skillFocus || 'General'}</p>
                    </div>
                  </div>
                  {campaign?.metadata?.tags && campaign.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {campaign.metadata.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="px-2 py-1 rounded-md bg-white/5 text-xs text-white/60">
                          {tag}
                        </span>
                      ))}
                      {campaign.metadata.tags.length > 3 && (
                        <span className="px-2 py-1 rounded-md bg-white/5 text-xs text-white/40">
                          +{campaign.metadata.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <VideoIcon className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-white/50 uppercase tracking-wide">Content</p>
                      <p className="text-sm font-medium text-white">{totalVideos} video{totalVideos !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/50">Questions</span>
                      <span className="text-white">{totalQuestions}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Videos */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-4">Campaign Content</p>
              {Object.keys(videos).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(videos).map(([videoId, video], index) => (
                    <div key={videoId} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                      <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center text-white font-semibold">
                        {index + 1}
                      </div>
                      {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt="" className="h-14 w-20 rounded-lg object-cover bg-black" />
                      ) : (
                        <div className="h-14 w-20 rounded-lg bg-white/5 flex items-center justify-center">
                          <VideoIcon className="h-5 w-5 text-white/30" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white truncate">{video.title}</h4>
                        <div className="flex items-center gap-4 text-xs text-white/50 mt-1">
                          {video.duration && (
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {formatDuration(video.duration)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <HelpCircle size={12} />
                            {video.questions?.length || 0} questions
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 rounded-xl bg-white/5 border border-white/5 text-center text-white/40">
                  <VideoIcon className="mx-auto mb-3 opacity-30" size={32} />
                  <p>No videos in this campaign</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'participants':
        return (
          <div className="space-y-6">
            {/* Filters */}
            {(departments.length > 0 || cohorts.length > 0) && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Filter size={14} />
                  <span>Filter:</span>
                </div>
                {departments.length > 0 && (
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-white/20"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                )}
                {cohorts.length > 0 && (
                  <select
                    value={selectedCohort}
                    onChange={(e) => setSelectedCohort(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-white/20"
                  >
                    <option value="all">All Cohorts</option>
                    {cohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
                    ))}
                  </select>
                )}
                {isFiltered && (
                  <button
                    onClick={() => {
                      setSelectedDepartment('all');
                      setSelectedCohort('all');
                    }}
                    className="text-xs text-white/50 hover:text-white transition"
                  >
                    Clear
                  </button>
                )}
                {isFiltered && (
                  <span className="text-xs text-white/40 ml-auto">
                    {filteredParticipantData.length} of {participantData.length} participants
                  </span>
                )}
              </div>
            )}

            {/* Participant List */}
            {filteredParticipantData.length > 0 ? (
              <div className="space-y-2">
                {filteredParticipantData.map((p) => {
                  const statusConfig = getEnrollmentStatusConfig(p.enrollment.status);
                  const isExpanded = expandedParticipant === p.userId;

                  return (
                    <div key={p.userId} className="rounded-xl bg-white/5 border border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedParticipant(isExpanded ? null : p.userId)}
                        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
                            <User className="text-white/50" size={16} />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-white">{p.userName}</p>
                            <p className="text-xs text-white/40">{p.userEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                            {p.enrollment.status.replace('-', ' ')}
                          </span>
                          <div className="flex items-center gap-2 w-20">
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-white rounded-full" style={{ width: `${p.completionRate}%` }} />
                            </div>
                            <span className="text-xs text-white/50">{p.completionRate}%</span>
                          </div>
                          {isExpanded ? <ChevronUp className="text-white/40" size={16} /> : <ChevronDown className="text-white/40" size={16} />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-white/5">
                          <div className="space-y-3">
                            <div className="flex items-center gap-4 text-xs text-white/50">
                              <span>Enrolled: {formatDate(p.enrollment.enrolledAt)}</span>
                              {p.enrollment.lastAccessedAt && (
                                <span>Last active: {formatDate(p.enrollment.lastAccessedAt)}</span>
                              )}
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Responses ({p.responses.length})</p>
                            {p.responses.length > 0 ? (
                              <div className="space-y-2">
                                {p.responses.slice(0, 5).map((r) => {
                                  const video = videos[r.videoId];
                                  const question = video?.questions?.find((q) => q.id === r.questionId);
                                  return (
                                    <div key={r.id} className="p-3 rounded-lg bg-white/5 text-sm">
                                      <p className="text-white/40 text-xs mb-1">
                                        {video?.title} • {formatDate(r.answeredAt)}
                                      </p>
                                      <p className="text-white/70 mb-1">{question?.statement || 'Unknown question'}</p>
                                      <p className="text-white font-medium">
                                        {typeof r.answer === 'number'
                                          ? `Score: ${r.answer}`
                                          : typeof r.answer === 'object' && r.answer !== null && 'selectedOptionId' in r.answer
                                            ? `Choice selected (Score: ${(r.answer as SJTAnswer).intentScore})`
                                            : String(r.answer)}
                                      </p>
                                    </div>
                                  );
                                })}
                                {p.responses.length > 5 && (
                                  <p className="text-xs text-white/40 text-center">+{p.responses.length - 5} more responses</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-white/40">No responses yet</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 rounded-xl bg-white/5 border border-white/5 text-center text-white/40">
                <Users className="mx-auto mb-3 opacity-30" size={32} />
                <p>No participants from your organization yet</p>
              </div>
            )}
          </div>
        );

      case 'responses':
        return (
          <div className="space-y-8">
            {/* Filters */}
            {(departments.length > 0 || cohorts.length > 0) && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Filter size={14} />
                  <span>Filter:</span>
                </div>
                {departments.length > 0 && (
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-white/20"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                )}
                {cohorts.length > 0 && (
                  <select
                    value={selectedCohort}
                    onChange={(e) => setSelectedCohort(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-white/20"
                  >
                    <option value="all">All Cohorts</option>
                    {cohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
                    ))}
                  </select>
                )}
                {isFiltered && (
                  <button
                    onClick={() => {
                      setSelectedDepartment('all');
                      setSelectedCohort('all');
                    }}
                    className="text-xs text-white/50 hover:text-white transition"
                  >
                    Clear
                  </button>
                )}
                {isFiltered && (
                  <span className="text-xs text-white/40 ml-auto">Showing filtered results</span>
                )}
              </div>
            )}

            {/* Skill Assessment Summary */}
            {skillAggregates.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-4">Assessment by Skill</p>
                <div className="space-y-3">
                  {skillAggregates.map(skill => (
                    <div key={skill.skillId} className="p-4 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                        <div>
                          <span className="font-medium text-white">{skill.skillName}</span>
                          <span className="text-white/40 text-sm ml-2">({skill.competencyName})</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-white">
                            Score: <strong className={`${skill.avgScore >= 70 ? 'text-emerald-400' : skill.avgScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{skill.avgScore}%</strong>
                          </span>
                          <span className="text-white/40">
                            ({skill.assessmentCount} assessment{skill.assessmentCount !== 1 ? 's' : ''})
                          </span>
                        </div>
                      </div>
                      <div className="relative h-2 bg-white/10 rounded-full overflow-visible">
                        <div
                          className={`h-full rounded-full transition-all ${skill.avgScore >= 70 ? 'bg-emerald-400' : skill.avgScore >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.min(skill.avgScore, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Response Distribution by Video */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-4">Response Distribution by Video</p>
              {videoAggregates.length > 0 ? (
                <div className="space-y-6">
                  {videoAggregates.map((videoAgg) => (
                    <div key={videoAgg.videoId} className="rounded-xl bg-white/5 border border-white/5 overflow-hidden">
                      {/* Video Header */}
                      <div className="px-4 py-3 bg-white/5 border-b border-white/5">
                        <h4 className="font-medium text-white">{videoAgg.videoTitle}</h4>
                        <p className="text-xs text-white/40 mt-0.5">
                          {videoAgg.questions.length} question{videoAgg.questions.length !== 1 ? 's' : ''}
                        </p>
                      </div>

                      {/* Questions */}
                      <div className="divide-y divide-white/5">
                        {videoAgg.questions.map((qAgg, qIndex) => (
                          <div key={qAgg.question.id} className="p-4">
                            <div className="flex items-start gap-3 mb-4">
                              <div className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center text-white/60 text-xs font-semibold">
                                Q{qIndex + 1}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${qAgg.question.type === 'qualitative'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : qAgg.question.type === 'behavioral-intent'
                                      ? 'bg-purple-500/10 text-purple-400'
                                      : 'bg-blue-500/10 text-blue-400'
                                    }`}>
                                    {qAgg.question.type === 'qualitative' ? (
                                      <MessageCircle size={10} />
                                    ) : (
                                      <BarChart3 size={10} />
                                    )}
                                    {qAgg.question.type === 'qualitative'
                                      ? 'Open-ended'
                                      : qAgg.question.type === 'behavioral-intent'
                                        ? 'Multiple Choice'
                                        : 'Scale'}
                                  </span>
                                </div>
                                <p className="text-white/90 text-sm">{qAgg.question.statement}</p>
                              </div>
                            </div>

                            <div className="bg-white/5 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs text-white/40">
                                  {qAgg.responses.length} response{qAgg.responses.length !== 1 ? 's' : ''}
                                </span>
                                {qAgg.avgScore !== undefined && (
                                  <span className="text-xs font-semibold text-white">
                                    {qAgg.question.type === 'behavioral-intent'
                                      ? `Avg Score: ${qAgg.avgScore}%`
                                      : `Avg: ${qAgg.avgScore.toFixed(1)}`}
                                  </span>
                                )}
                              </div>

                              {/* Qualitative: Word Cloud + Text responses */}
                              {qAgg.question.type === 'qualitative' ? (
                                <div className="space-y-4">
                                  {/* Word Cloud */}
                                  {qAgg.responses.length > 0 && (() => {
                                    // Common stop words to filter out
                                    const stopWords = new Set([
                                      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                                      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
                                      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
                                      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
                                      'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
                                      'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
                                      'his', 'our', 'their', 'what', 'which', 'who', 'whom', 'when',
                                      'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
                                      'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
                                      'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now',
                                      'about', 'into', 'through', 'during', 'before', 'after', 'above',
                                      'below', 'between', 'under', 'again', 'further', 'then', 'once',
                                      'here', 'there', 'any', 'if', 'because', 'until', 'while', 'get',
                                      'got', 'am', 'being', 'having', 'doing', 'would', 'think', 'like'
                                    ]);

                                    // Extract and count words
                                    const wordCounts: Record<string, number> = {};
                                    qAgg.responses.forEach((r) => {
                                      const text = typeof r.answer === 'string' ? r.answer : '';
                                      const words = text.toLowerCase()
                                        .replace(/[^\w\s]/g, '')
                                        .split(/\s+/)
                                        .filter(w => w.length > 2 && !stopWords.has(w));

                                      words.forEach(word => {
                                        wordCounts[word] = (wordCounts[word] || 0) + 1;
                                      });
                                    });

                                    // Get top words sorted by frequency
                                    const sortedWords = Object.entries(wordCounts)
                                      .sort((a, b) => b[1] - a[1])
                                      .slice(0, 30);

                                    if (sortedWords.length === 0) return null;

                                    const maxCount = sortedWords[0][1];
                                    const minCount = sortedWords[sortedWords.length - 1][1];

                                    // Color palette for word cloud
                                    const colors = [
                                      'text-blue-400', 'text-purple-400', 'text-emerald-400',
                                      'text-amber-400', 'text-pink-400', 'text-cyan-400',
                                      'text-orange-400', 'text-indigo-400'
                                    ];

                                    return (
                                      <div>
                                        <p className="text-xs text-white/50 mb-3">Word Cloud</p>
                                        <div className="bg-white/5 rounded-lg p-4 flex flex-wrap gap-2 justify-center items-center min-h-[100px]">
                                          {sortedWords.map(([word, count], idx) => {
                                            // Calculate font size based on frequency (12px to 28px)
                                            const ratio = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
                                            const fontSize = Math.round(12 + ratio * 16);
                                            const opacity = 0.5 + ratio * 0.5;
                                            const colorClass = colors[idx % colors.length];

                                            return (
                                              <span
                                                key={word}
                                                className={`${colorClass} transition-all hover:scale-110 cursor-default`}
                                                style={{
                                                  fontSize: `${fontSize}px`,
                                                  opacity,
                                                  fontWeight: ratio > 0.5 ? 600 : 400,
                                                }}
                                                title={`"${word}" appears ${count} time${count !== 1 ? 's' : ''}`}
                                              >
                                                {word}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Sample Responses */}
                                  <div>
                                    <p className="text-xs text-white/50 mb-2">Sample Responses</p>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                      {qAgg.responses.slice(0, 5).map((r) => (
                                        <div key={r.id} className="bg-white/5 rounded-lg p-3 text-sm text-white/70">
                                          "{typeof r.answer === 'object' ? JSON.stringify(r.answer) : String(r.answer)}"
                                        </div>
                                      ))}
                                      {qAgg.responses.length > 5 && (
                                        <p className="text-xs text-white/40 text-center">
                                          +{qAgg.responses.length - 5} more responses
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : qAgg.question.type === 'behavioral-intent' && qAgg.question.options ? (
                                /* Q2: Multiple Choice Distribution with Recharts */
                                <div className="space-y-4">
                                  {/* Frequency Distribution Bar Chart */}
                                  <div>
                                    <p className="text-xs text-white/50 mb-3">Selection Distribution</p>
                                    <div className="h-[120px]">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                          data={qAgg.question.options.map((opt, idx) => ({
                                            label: String.fromCharCode(65 + idx),
                                            count: qAgg.choiceDistribution?.[opt.id] || 0,
                                            intentScore: opt.intentScore,
                                            isBest: opt.id === qAgg.benchmarkOptionId,
                                          }))}
                                          layout="vertical"
                                        >
                                          <XAxis type="number" hide />
                                          <YAxis dataKey="label" type="category" width={30} tick={{ fontSize: 12 }} stroke="#6B7280" />
                                          <Tooltip
                                            contentStyle={{
                                              backgroundColor: '#1F1F1F',
                                              border: '1px solid #374151',
                                              borderRadius: '6px',
                                              color: '#E5E5E5',
                                            }}
                                            itemStyle={{ color: '#E5E5E5' }}
                                            labelStyle={{ color: '#E5E5E5' }}
                                            formatter={(value: number, _name: string, props: any) => [
                                              `${value} responses (Score: ${props.payload.intentScore})`,
                                              props.payload.isBest ? 'Best Answer' : 'Selection'
                                            ]}
                                          />
                                          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                            {qAgg.question.options.map((opt) => (
                                              <Cell
                                                key={opt.id}
                                                fill={opt.intentScore >= 6 ? '#10B981' : opt.intentScore >= 4 ? '#3B82F6' : '#EF4444'}
                                                stroke={opt.id === qAgg.benchmarkOptionId ? '#F59E0B' : 'transparent'}
                                                strokeWidth={opt.id === qAgg.benchmarkOptionId ? 2 : 0}
                                              />
                                            ))}
                                          </Bar>
                                        </BarChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>

                                  {/* Option Legend */}
                                  <div className="space-y-1.5 pt-2 border-t border-white/10">
                                    {qAgg.question.options.map((option, idx) => {
                                      const count = qAgg.choiceDistribution?.[option.id] || 0;
                                      const total = qAgg.responses.length;
                                      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                                      const isBenchmark = option.id === qAgg.benchmarkOptionId;
                                      const intentScore = option.intentScore;

                                      return (
                                        <div key={option.id} className={`flex items-center gap-2 p-2 rounded-lg ${isBenchmark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-white/5'
                                          }`}>
                                          <div className={`h-5 w-5 rounded flex items-center justify-center text-xs font-bold ${intentScore >= 6 ? 'bg-emerald-500/20 text-emerald-400'
                                            : intentScore <= 2 ? 'bg-red-500/20 text-red-400'
                                              : 'bg-white/10 text-white/60'
                                            }`}>
                                            {String.fromCharCode(65 + idx)}
                                          </div>
                                          <span className={`flex-1 text-xs truncate ${isBenchmark ? 'text-amber-400' : 'text-white/70'}`}>
                                            {option.text}
                                          </span>
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${intentScore >= 6 ? 'bg-emerald-500/20 text-emerald-400'
                                              : intentScore <= 2 ? 'bg-red-500/20 text-red-400'
                                                : 'bg-white/10 text-white/50'
                                              }`}>
                                              Score: {intentScore}
                                            </span>
                                            <span className="text-xs text-white/40 w-16 text-right">
                                              {count} ({percentage}%)
                                            </span>
                                          </div>
                                          {isBenchmark && (
                                            <span className="text-[10px] text-amber-500 font-medium">BEST</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Legend */}
                                  <div className="flex items-center justify-center gap-4 text-[10px] text-white/40 pt-2">
                                    <span className="flex items-center gap-1">
                                      <div className="w-2 h-2 rounded bg-amber-500" />
                                      Best Answer
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <div className="w-2 h-2 rounded bg-emerald-400" />
                                      High (6-7)
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <div className="w-2 h-2 rounded bg-blue-400" />
                                      Medium (4-5)
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <div className="w-2 h-2 rounded bg-red-400" />
                                      Low (1-2)
                                    </span>
                                  </div>
                                </div>
                              ) : qAgg.distribution ? (
                                /* Q1: Scale Distribution with Recharts */
                                <div>
                                  <div className="h-[100px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={[1, 2, 3, 4, 5, 6, 7].map(score => ({
                                        score,
                                        count: qAgg.distribution![score] || 0,
                                      }))}>
                                        <XAxis dataKey="score" stroke="#6B7280" tick={{ fontSize: 11 }} />
                                        <YAxis hide />
                                        <Tooltip
                                          contentStyle={{
                                            backgroundColor: '#1F1F1F',
                                            border: '1px solid #374151',
                                            borderRadius: '6px',
                                            color: '#E5E5E5',
                                          }}
                                          itemStyle={{ color: '#E5E5E5' }}
                                          labelStyle={{ color: '#E5E5E5' }}
                                          formatter={(value: number) => [`${value} responses`, 'Count']}
                                        />
                                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                          {[1, 2, 3, 4, 5, 6, 7].map((score) => (
                                            <Cell
                                              key={score}
                                              fill={qAgg.question.benchmarkScore && score < qAgg.question.benchmarkScore ? '#EF4444' : '#10B981'}
                                            />
                                          ))}
                                        </Bar>
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                  {qAgg.question.benchmarkScore && (
                                    <div className="flex items-center justify-between mt-2 text-xs">
                                      <span className="text-white/50">
                                        Avg: {qAgg.avgScore?.toFixed(1)} • Benchmark: {qAgg.question.benchmarkScore}
                                      </span>
                                      <span className={`font-medium ${(qAgg.avgScore || 0) >= qAgg.question.benchmarkScore ? 'text-green-500' : 'text-red-500'}`}>
                                        {((qAgg.avgScore || 0) - qAgg.question.benchmarkScore).toFixed(1)} deviation
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-white/40">No data available</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 rounded-xl bg-white/5 border border-white/5 text-center text-white/40">
                  <BarChart3 className="mx-auto mb-3 opacity-30" size={32} />
                  <p>No responses yet</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-8">
            {/* Access Control */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-4">Access Control</p>
              <div className="rounded-xl bg-white/5 border border-white/5 divide-y divide-white/5">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-white/50">Organizations</span>
                  <span className="text-sm font-medium text-white">
                    {campaign?.allowedOrganizations && campaign.allowedOrganizations.length > 0
                      ? campaign.allowedOrganizations.length + ' selected'
                      : 'All'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-white/50">Departments</span>
                  <span className="text-sm font-medium text-white">
                    {campaign?.allowedDepartments && campaign.allowedDepartments.length > 0
                      ? campaign.allowedDepartments.join(', ')
                      : 'All'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-white/50">Cohorts</span>
                  <span className="text-sm font-medium text-white">
                    {campaign?.allowedCohortIds && campaign.allowedCohortIds.length > 0
                      ? campaign.allowedCohortIds.length + ' selected'
                      : 'All'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-white/50">Specific Employees</span>
                  <span className="text-sm font-medium text-white">
                    {campaign?.allowedEmployeeIds && campaign.allowedEmployeeIds.length > 0
                      ? campaign.allowedEmployeeIds.length + ' selected'
                      : 'All'}
                  </span>
                </div>
              </div>
            </div>

            {/* Campaign Options */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-4">Options</p>
              <div className="rounded-xl bg-white/5 border border-white/5 divide-y divide-white/5">
                {[
                  { label: 'Anonymous Responses', value: campaign?.anonymousResponses },
                  { label: 'Auto-send Invites', value: campaign?.automation?.autoSendInvites },
                  { label: 'One-time Access', value: campaign?.accessControl?.oneTimeAccess },
                  { label: 'Send Reminders', value: campaign?.automation?.sendReminders },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-white/50">{item.label}</span>
                    <div className="flex items-center gap-2">
                      {item.value ? (
                        <Check size={14} className="text-emerald-400" />
                      ) : (
                        <X size={14} className="text-white/30" />
                      )}
                      <span className="text-sm font-medium text-white">{item.value ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-4">Actions</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate(`/admin/campaigns?edit=${campaignId}`)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition flex items-center gap-2"
                >
                  <Edit size={16} />
                  Edit Campaign
                </button>
                {campaignStatus === 'draft' ? (
                  <button
                    onClick={handleTogglePublish}
                    disabled={publishing}
                    className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <Play size={16} />
                    Launch Campaign
                  </button>
                ) : (
                  <button
                    onClick={handleTogglePublish}
                    disabled={publishing}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <Pause size={16} />
                    Pause Campaign
                  </button>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="text-white p-6 md:p-10 min-h-[calc(100vh-140px)] flex flex-col">
        <div className="max-w-6xl mx-auto flex-1 flex flex-col w-full">
          {/* Back Button Skeleton */}
          <Skeleton className="h-5 w-32 mb-6" />

          {/* Header Skeleton */}
          <div className="flex items-start gap-6 mb-8">
            <Skeleton className="h-16 w-16 rounded-2xl flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-7 w-80" />
              <Skeleton className="h-4 w-[480px]" />
              <div className="flex items-center gap-2 pt-1">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            </div>
          </div>

          {/* Main Layout Skeleton */}
          <div className="flex gap-8 flex-1">
            {/* Sidebar Skeleton */}
            <aside className="w-56 flex-shrink-0 space-y-1">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </aside>

            {/* Divider */}
            <div className="w-px bg-white/5 rounded-full self-stretch" />

            {/* Content Skeleton */}
            <main className="flex-1 min-w-0 space-y-6">
              {/* Filters Row */}
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-8 w-36 rounded-lg" />
                <Skeleton className="h-8 w-32 rounded-lg" />
              </div>

              {/* Stats Grid - 4 columns */}
              <div>
                <Skeleton className="h-4 w-32 mb-4" />
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-3 mb-3">
                        <Skeleton className="h-5 w-5 rounded" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-8 w-12" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Two Column Layout: Campaign Info + Videos */}
              <div className="grid grid-cols-2 gap-6">
                {/* Campaign Info */}
                <div>
                  <Skeleton className="h-4 w-28 mb-4" />
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <Skeleton className="h-4 w-4 rounded" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-5 w-32 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Videos */}
                <div>
                  <Skeleton className="h-4 w-24 mb-4" />
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-28" />
                        </div>
                        <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="p-6 md:p-10 min-h-[calc(100vh-140px)]">
        <div className="max-w-6xl mx-auto space-y-6">
          <button onClick={() => navigate('/admin/campaigns')} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition">
            <ArrowLeft size={16} /> Back to Campaigns
          </button>
          <div className="p-12 rounded-xl bg-white/5 border border-white/5 text-center">
            <Megaphone className="h-16 w-16 text-white/20 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">{error || 'Campaign not found'}</h2>
            <p className="text-white/40">The campaign you're looking for doesn't exist or has been removed.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-white p-6 md:p-10 min-h-[calc(100vh-140px)] flex flex-col">
      <div className="max-w-6xl mx-auto flex-1 flex flex-col w-full">
        {/* Back Button */}
        <button
          onClick={() => navigate('/admin/campaigns')}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition mb-6 w-fit"
        >
          <ArrowLeft size={16} /> Back to Campaigns
        </button>

        {/* Header */}
        <div className="flex flex-wrap items-start gap-6 mb-8">
          <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            <Megaphone className="h-8 w-8 text-white/60" />
          </div>
          <div className="flex-1 min-w-[240px] space-y-2">
            <h1 className="text-2xl font-semibold text-white">{campaign.title}</h1>
            {campaign.description && (
              <p className="text-sm text-white/50 max-w-xl">{campaign.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border border-white/10 ${statusConfig.bg} ${statusConfig.text}`}>
                <div className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                {campaignStatus.charAt(0).toUpperCase() + campaignStatus.slice(1)}
              </span>
              {campaign.source === 'dicode' && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400">
                  DiCode
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/70">
                <VideoIcon size={12} /> {totalVideos} video{totalVideos !== 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/70">
                <HelpCircle size={12} /> {totalQuestions} question{totalQuestions !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* 3-dot Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition"
            >
              <MoreVertical size={20} />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-[#1A1A1A] shadow-xl z-20 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => {
                      navigate(`/admin/campaigns?edit=${campaignId}`);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition"
                  >
                    <Edit size={16} />
                    Edit Campaign
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition"
                  >
                    <Copy size={16} />
                    Copy Link
                  </button>
                  <button
                    onClick={() => {
                      window.open(`/campaign/${campaignId}`, '_blank');
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition"
                  >
                    <ExternalLink size={16} />
                    Preview
                  </button>
                  <div className="my-1 border-t border-white/10" />
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition"
                  >
                    <Trash2 size={16} />
                    Delete Campaign
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main Layout */}
        <div className="flex flex-col lg:flex-row gap-8 flex-1">
          {/* Sidebar */}
          <aside className="w-full lg:w-56 flex-shrink-0 space-y-1 lg:sticky lg:top-0 h-fit">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </aside>

          {/* Divider */}
          <div className="hidden lg:block w-px bg-white/5 rounded-full self-stretch" />

          {/* Content */}
          <main className="flex-1 min-w-0 max-w-3xl">
            {renderContent()}
          </main>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          />
          <div className="relative bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Campaign</h3>
                <p className="text-sm text-white/50">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-white/70 mb-6">
              Are you sure you want to delete <strong className="text-white">{campaign?.title}</strong>? All associated data including enrollments and responses will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCampaign}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
    </div>
  );
};

export default AdminCampaignDetails;
