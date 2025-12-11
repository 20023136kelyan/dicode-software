import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useUserStatsRealtime,
  useSkillScoresRealtime,
  useBadgesRealtime,
  getSortedCompetencies,
  getRecentBadges,
} from '@/hooks/useUserStats';
import { useUserEnrollmentsRealtime } from '@/hooks/useEnrollmentRealtime';
import { useSkillProgress, useChartData } from '@/hooks/useSkillHistory';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import {
  ArrowLeft,
  Award,
  BookOpen,
  TrendingUp,
  Star,
  Zap,
  Send,
  Flame,
  AlertCircle,
  Mail,
  Building2,
  Trash2,
  Edit2,
  Calendar,
  Users,
  UserCircle,
  Trophy,
  Target,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  BarChart3,
  User,
  FileText,
  Hexagon,
  List,
  MoreHorizontal,
  X,
  Plus,
  Shield,
} from 'lucide-react';
import { Employee, Cohort, UserRole } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/shared/Skeleton';
import Avatar from '@/components/shared/Avatar';
import {
  getUsersByOrganization,
  getCohortsByOrganization,
  deleteUserProfile,
  addEmployeeToCohort,
  removeEmployeeFromCohort,
  updateUserCohorts,
  getCampaign,
  upsertUserProfile,
  createCohort,
  getOrganization,
} from '@/lib/firestore';
import { COMPETENCIES } from '@/lib/competencies';

// Distinct colors for competency chart lines
const CHART_COLORS = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb923c'];

const EmployeeDetail: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [employeeCohorts, setEmployeeCohorts] = useState<Cohort[]>([]);
  const [showAssignCohort, setShowAssignCohort] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [campaignTab, setCampaignTab] = useState<'in-progress' | 'completed'>('in-progress');

  // Quick action states
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showCohortSidebar, setShowCohortSidebar] = useState(false);
  const [showDeptSidebar, setShowDeptSidebar] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');
  const [isCreatingDept, setIsCreatingDept] = useState(false);
  const [isCreatingCohort, setIsCreatingCohort] = useState(false);
  const [newCohortName, setNewCohortName] = useState('');
  const [existingDepartments, setExistingDepartments] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [campaignTitles, setCampaignTitles] = useState<Record<string, string>>({});
  const [expandedCompetency, setExpandedCompetency] = useState<string | null>(null);
  const [proficiencyView, setProficiencyView] = useState<'bars' | 'radar'>('bars');

  // Navigation state
  const [activeTab, setActiveTab] = useState('overview');

  // Chart filter states
  const [chartTimePeriod, setChartTimePeriod] = useState<number>(90);
  const [chartCompetencyFilter, setChartCompetencyFilter] = useState<string>('all');

  // Fetch real-time user stats
  const { stats: userStats } = useUserStatsRealtime(employeeId || '');
  const { enrollments } = useUserEnrollmentsRealtime(employeeId || '');
  const { skillScores } = useSkillScoresRealtime(employeeId || '');
  const { badges } = useBadgesRealtime(employeeId || '');

  // Fetch skill progress history for charts
  const skillProgressOptions = useMemo(() => ({ days: chartTimePeriod }), [chartTimePeriod]);
  const { progress: skillProgress, isLoading: skillProgressLoading } = useSkillProgress(
    employeeId || '',
    user?.organization || '',
    skillProgressOptions
  );
  const { data: competencyChartData, labels: competencyLabels } = useChartData(skillProgress, 'competencies');

  // Filter chart data by selected competency
  const filteredChartData = useMemo(() => {
    if (chartCompetencyFilter === 'all') return competencyChartData;
    return competencyChartData.map(point => {
      const filtered: { date: string; [key: string]: string | number | null } = { date: point.date };
      for (const key of Object.keys(point)) {
        if (key === 'date') continue;
        if (key.toLowerCase().replace(/\s+/g, '-') === chartCompetencyFilter || key === chartCompetencyFilter) {
          filtered[key] = point[key];
        }
      }
      return filtered;
    });
  }, [competencyChartData, chartCompetencyFilter]);

  const filteredLabels = useMemo(() => {
    if (chartCompetencyFilter === 'all') return competencyLabels;
    return competencyLabels.filter(label =>
      label.toLowerCase().replace(/\s+/g, '-') === chartCompetencyFilter || label === chartCompetencyFilter
    );
  }, [competencyLabels, chartCompetencyFilter]);

  // Derived data
  const topCompetencies = useMemo(() => {
    const assessedCompetencies = getSortedCompetencies(skillScores.competencyScores);
    return COMPETENCIES.map(compDef => {
      const assessed = assessedCompetencies.find(c => c.competencyId === compDef.id);
      if (assessed) return assessed;
      return {
        competencyId: compDef.id,
        competencyName: compDef.name,
        currentScore: 0,
        level: 1,
        skillCount: compDef.skills.length,
        assessedSkillCount: 0,
      };
    });
  }, [skillScores.competencyScores]);

  const recentBadges = getRecentBadges(badges, 8);
  const completedEnrollments = enrollments.filter((e) => e.status === 'completed');
  const inProgressEnrollments = enrollments.filter((e) => e.status === 'in-progress');

  // Navigation items
  const NAV_ITEMS = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'proficiency', label: 'Skills Proficiency', icon: Target },
    { id: 'campaigns', label: 'Campaigns', icon: BookOpen },
    { id: 'details', label: 'Details', icon: FileText },
  ];

  useEffect(() => {
    const loadData = async () => {
      if (!user?.organization || !employeeId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [employees, loadedCohorts, organization] = await Promise.all([
          getUsersByOrganization(user.organization),
          getCohortsByOrganization(user.organization),
          getOrganization(user.organization),
        ]);
        const foundEmployee = employees.find((e) => e.id === employeeId);
        setEmployee(foundEmployee || null);
        setCohorts(loadedCohorts);
        if (foundEmployee?.cohortIds) {
          const empCohorts = loadedCohorts.filter((c) => foundEmployee.cohortIds?.includes(c.id));
          setEmployeeCohorts(empCohorts);
        }
        // Get departments from organization
        const depts = (organization?.departments || []).sort();
        setExistingDepartments(depts);
      } catch (error) {
        console.error('Failed to load employee data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user?.organization, employeeId]);

  useEffect(() => {
    const fetchCampaignTitles = async () => {
      const uniqueCampaignIds = [...new Set(enrollments.map((e) => e.campaignId))];
      const titles: Record<string, string> = {};
      for (const campaignId of uniqueCampaignIds) {
        if (!campaignTitles[campaignId]) {
          try {
            const campaign = await getCampaign(campaignId);
            if (campaign) titles[campaignId] = campaign.title;
          } catch (err) {
            console.warn('Failed to fetch campaign:', campaignId);
          }
        }
      }
      if (Object.keys(titles).length > 0) {
        setCampaignTitles((prev) => ({ ...prev, ...titles }));
      }
    };
    if (enrollments.length > 0) fetchCampaignTitles();
  }, [enrollments]);

  // Click outside to close actions menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
    };

    if (showActionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionsMenu]);

  const handleDeleteEmployee = async () => {
    if (!employee) return;
    setIsDeleting(true);
    try {
      for (const cohort of employeeCohorts) {
        await removeEmployeeFromCohort(cohort.id, employee.id);
      }
      await deleteUserProfile(employee.id);
      navigate('/admin/employees');
    } catch (error) {
      console.error('Failed to delete employee:', error);
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleRoleChange = async (newRole: UserRole) => {
    if (!employee) return;
    setIsUpdatingRole(true);
    try {
      await upsertUserProfile(employee.id, { role: newRole });
      setEmployee({ ...employee, role: newRole });
      setShowRoleModal(false);
    } catch (error) {
      console.error('Failed to update role:', error);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleAssignCohort = async () => {
    if (!employee || !selectedCohortId) return;
    try {
      for (const cohort of employeeCohorts) {
        await removeEmployeeFromCohort(cohort.id, employee.id);
      }
      const newCohortIds: string[] = [];
      if (selectedCohortId !== 'none') {
        await addEmployeeToCohort(selectedCohortId, employee.id);
        newCohortIds.push(selectedCohortId);
      }
      await updateUserCohorts(employee.id, newCohortIds);
      const newCohorts = cohorts.filter((c) => newCohortIds.includes(c.id));
      setEmployeeCohorts(newCohorts);
      setEmployee({ ...employee, cohortIds: newCohortIds.length > 0 ? newCohortIds : undefined });
      setShowAssignCohort(false);
      setSelectedCohortId('');
    } catch (error) {
      console.error('Failed to assign cohort:', error);
      alert('Failed to assign cohort. Please try again.');
    }
  };

  const formatDate = (date: Date | string | number | undefined) => {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getSkillsForCompetency = (competencyId: string) => {
    const competencyDef = COMPETENCIES.find(c => c.id === competencyId);
    if (!competencyDef) return [];
    return competencyDef.skills.map(skillDef => {
      const assessedSkill = Object.values(skillScores.skills).find(
        s => s.skillId === skillDef.id && s.competencyId === competencyId
      );
      if (assessedSkill) return assessedSkill;
      return {
        skillId: skillDef.id,
        skillName: skillDef.name,
        competencyId: competencyId,
        currentScore: 0,
        level: 1,
        history: [],
      };
    });
  };

  const xpProgress = userStats.xpToNextLevel > 0
    ? Math.min(100, (userStats.xpInCurrentLevel / userStats.xpToNextLevel) * 100)
    : 100;

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-4">Performance Stats</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <Star className="text-white/40" size={18} />
                    <span className="text-xs text-white/50 uppercase tracking-wider">Level</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{userStats.level}</div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5 relative">
                  <div className="flex items-center gap-3 mb-2">
                    <Flame className="text-white/40" size={18} />
                    <span className="text-xs text-white/50 uppercase tracking-wider">Streak</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {userStats.currentStreak} <span className="text-sm font-normal text-white/40">days</span>
                  </div>
                  {userStats.streakAtRisk && (
                    <AlertCircle className="absolute top-3 right-3 text-amber-500/60" size={14} />
                  )}
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="text-white/40" size={18} />
                    <span className="text-xs text-white/50 uppercase tracking-wider">Total XP</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{userStats.totalXp.toLocaleString()}</div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <BookOpen className="text-white/40" size={18} />
                    <span className="text-xs text-white/50 uppercase tracking-wider">Completed</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{completedEnrollments.length}</div>
                </div>
              </div>
            </div>

            {/* XP Progress */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">Level Progress</p>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex justify-between text-xs text-white/50 mb-2">
                  <span>Level {userStats.level}</span>
                  <span>{userStats.xpToNextLevel} XP to Level {userStats.level + 1}</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all" style={{ width: `${xpProgress}%` }} />
                </div>
              </div>
            </div>

            {/* Week Activity */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">This Week's Activity</p>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                    <div key={day} className="flex flex-col items-center gap-1.5">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center border ${
                          userStats.streakDays[i]
                            ? 'bg-white/10 border-white/20'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        {userStats.streakDays[i] ? (
                          <CheckCircle2 className="text-white/60" size={14} />
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                        )}
                      </div>
                      <span className="text-[10px] text-white/40">{day}</span>
                    </div>
                  ))}
                  <div className="ml-auto text-xs text-white/50">
                    Best: <span className="text-white font-medium">{userStats.longestStreak} days</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">Badges Earned ({badges.length})</p>
              {recentBadges.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {recentBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-default"
                      title={`${badge.name}: ${badge.description}`}
                    >
                      <span className="text-xl">{badge.icon}</span>
                      <span className="text-[9px] text-white/40 text-center truncate w-full">{badge.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-white/5 border border-white/5 text-center text-white/40">
                  <Trophy className="mx-auto mb-2 opacity-30" size={24} />
                  <p className="text-sm">No badges earned yet</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'proficiency':
        // Prepare radar chart data
        const radarData = topCompetencies.map(comp => ({
          competency: comp.competencyName,
          score: Math.round(comp.currentScore),
          fullMark: 100,
        }));

        return (
          <div className="space-y-8">
            {/* Competencies Header with View Toggle */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Competencies</p>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
                  <button
                    onClick={() => setProficiencyView('bars')}
                    className={`p-1.5 rounded-md transition ${
                      proficiencyView === 'bars' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
                    }`}
                    title="List view"
                  >
                    <List size={16} />
                  </button>
                  <button
                    onClick={() => setProficiencyView('radar')}
                    className={`p-1.5 rounded-md transition ${
                      proficiencyView === 'radar' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
                    }`}
                    title="Radar view"
                  >
                    <Hexagon size={16} />
                  </button>
                </div>
              </div>

              {proficiencyView === 'radar' ? (
                <div className="rounded-xl bg-white/5 border border-white/5 p-6">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <PolarGrid stroke="rgba(255,255,255,0.1)" />
                        <PolarAngleAxis
                          dataKey="competency"
                          tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                          tickLine={false}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, 100]}
                          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                          tickCount={5}
                          axisLine={false}
                        />
                        <Radar
                          name="Score"
                          dataKey="score"
                          stroke="rgba(255,255,255,0.8)"
                          fill="rgba(255,255,255,0.15)"
                          strokeWidth={2}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => [`${value}%`, 'Score']}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {topCompetencies.map((comp) => (
                      <div key={comp.competencyId} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-medium">
                            L{comp.level}
                          </span>
                          <span className="text-white/70">{comp.competencyName}</span>
                        </div>
                        <span className="text-white/50">{Math.round(comp.currentScore)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
              <div className="space-y-3">
                {topCompetencies.map((competency) => {
                  const skills = getSkillsForCompetency(competency.competencyId);
                  const isExpanded = expandedCompetency === competency.competencyId;

                  return (
                    <div key={competency.competencyId} className="rounded-xl bg-white/5 border border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedCompetency(isExpanded ? null : competency.competencyId)}
                        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-1 rounded bg-white/10 text-white/70 text-xs font-medium">
                            L{competency.level}
                          </span>
                          <span className="text-sm text-white font-medium">{competency.competencyName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-white/40">
                            {competency.assessedSkillCount}/{competency.skillCount} skills
                          </span>
                          <span className="text-xs text-white/50">{Math.round(competency.currentScore)}%</span>
                          {isExpanded ? (
                            <ChevronUp className="text-white/40" size={16} />
                          ) : (
                            <ChevronDown className="text-white/40" size={16} />
                          )}
                        </div>
                      </button>

                      <div className="px-4 pb-1">
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white rounded-full"
                            style={{ width: `${competency.currentScore}%` }}
                          />
                        </div>
                      </div>

                      {isExpanded && skills.length > 0 && (
                        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-white/5 mt-3">
                          {skills.map((skill) => {
                            const isAssessed = skill.currentScore > 0 || (skill.history && skill.history.length > 0);
                            return (
                              <div key={skill.skillId} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isAssessed ? 'bg-white/10 text-white/60' : 'bg-white/5 text-white/30'}`}>
                                      L{skill.level}
                                    </span>
                                    <span className={isAssessed ? 'text-white/70' : 'text-white/40'}>
                                      {skill.skillName}
                                    </span>
                                    {!isAssessed && <span className="text-white/30 text-[10px]">(not assessed)</span>}
                                  </div>
                                  <span className={isAssessed ? 'text-white/50' : 'text-white/20'}>
                                    {Math.round(skill.currentScore)}%
                                  </span>
                                </div>
                                <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${isAssessed ? 'bg-white' : 'bg-white/5'}`}
                                    style={{ width: isAssessed ? `${skill.currentScore}%` : '0%' }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>

            {/* Progress Chart */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Score History</p>
                <div className="flex gap-3">
                  <select
                    value={chartCompetencyFilter}
                    onChange={(e) => setChartCompetencyFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-white/20"
                  >
                    <option value="all">All Competencies</option>
                    {COMPETENCIES.map((comp) => (
                      <option key={comp.id} value={comp.name}>{comp.name}</option>
                    ))}
                  </select>
                  <select
                    value={chartTimePeriod}
                    onChange={(e) => setChartTimePeriod(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-white/20"
                  >
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                    <option value={180}>6 months</option>
                    <option value={365}>1 year</option>
                  </select>
                </div>
              </div>

              <div className="rounded-xl bg-white/5 border border-white/5 p-4">
                {skillProgressLoading ? (
                  <div className="h-64 flex items-center justify-center text-white/40">Loading...</div>
                ) : filteredChartData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={filteredChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="date"
                          stroke="rgba(255,255,255,0.2)"
                          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getMonth() + 1}/${date.getDate()}`;
                          }}
                          interval="preserveStartEnd"
                          minTickGap={30}
                        />
                        <YAxis
                          domain={[0, 100]}
                          stroke="rgba(255,255,255,0.2)"
                          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                          labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          formatter={(value) => (value !== null && value !== undefined ? [`${value}%`, ''] : ['No data', ''])}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: '10px' }}
                          formatter={(value) => <span className="text-white/50 text-xs">{value}</span>}
                        />
                        {filteredLabels.map((label, index) => (
                          <Line
                            key={label}
                            type="monotone"
                            dataKey={label}
                            stroke={CHART_COLORS[index % CHART_COLORS.length]}
                            strokeWidth={1.5}
                            dot={false}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-white/40">
                    <BarChart3 className="mb-3 opacity-30" size={32} />
                    <p className="text-sm">No assessment history yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'campaigns':
        return (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setCampaignTab('in-progress')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  campaignTab === 'in-progress'
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                In Progress ({inProgressEnrollments.length})
              </button>
              <button
                onClick={() => setCampaignTab('completed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  campaignTab === 'completed'
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                Completed ({completedEnrollments.length})
              </button>
            </div>

            {/* Campaign List */}
            <div className="space-y-2">
              {campaignTab === 'in-progress' ? (
                inProgressEnrollments.length > 0 ? (
                  inProgressEnrollments.map((enrollment) => {
                    const totalModules = enrollment.totalModules || 0;
                    const completedModules = enrollment.completedModules || 0;
                    const progress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
                    return (
                      <div key={enrollment.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                            <BookOpen className="text-white/50" size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white truncate">
                              {campaignTitles[enrollment.campaignId] || `Campaign ${enrollment.campaignId.slice(0, 8)}...`}
                            </div>
                            <div className="text-xs text-white/40">Started {formatDate(enrollment.enrolledAt)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-20">
                            <div className="text-xs text-white/40 mb-1 text-right">{progress}%</div>
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-white rounded-full" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-12 rounded-xl bg-white/5 border border-white/5 text-center text-white/40">
                    <BookOpen className="mx-auto mb-3 opacity-30" size={32} />
                    <p>No campaigns in progress</p>
                  </div>
                )
              ) : completedEnrollments.length > 0 ? (
                completedEnrollments.map((enrollment) => (
                  <div key={enrollment.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="text-white/50" size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {campaignTitles[enrollment.campaignId] || `Campaign ${enrollment.campaignId.slice(0, 8)}...`}
                        </div>
                        <div className="text-xs text-white/40">Completed {formatDate(enrollment.completedAt)}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 rounded-xl bg-white/5 border border-white/5 text-center text-white/40">
                  <Trophy className="mx-auto mb-3 opacity-30" size={32} />
                  <p>No completed campaigns yet</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'details':
        return (
          <div className="space-y-8">
            {/* Employee Info */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-4">Employee Information</p>
              <div className="rounded-xl bg-white/5 border border-white/5 divide-y divide-white/5">
                {[
                  { label: 'Role', value: employee?.role || 'N/A' },
                  { label: 'Department', value: employee?.department || 'Not assigned' },
                  { label: 'Gender', value: employee?.gender?.replace('-', ' ') || 'Not specified' },
                  { label: 'Date of Birth', value: formatDate(employee?.dateOfBirth) },
                  { label: 'Last Login', value: employee?.lastLogin ? formatDate(employee.lastLogin) : 'Never' },
                  { label: 'Member Since', value: formatDate(employee?.createdAt) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-white/50">{item.label}</span>
                    <span className="text-sm font-medium text-white capitalize">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cohort Assignment */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Cohort Assignment</p>
                <button
                  onClick={() => {
                    setSelectedCohortId(employeeCohorts[0]?.id || 'none');
                    setShowAssignCohort(true);
                  }}
                  className="text-xs text-white/50 hover:text-white transition flex items-center gap-1"
                >
                  <Edit2 size={12} /> Edit
                </button>
              </div>

              {showAssignCohort ? (
                <div className="rounded-xl bg-white/5 border border-white/5 p-4 space-y-4">
                  <select
                    value={selectedCohortId}
                    onChange={(e) => setSelectedCohortId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-white/20 focus:outline-none"
                  >
                    <option value="none" className="bg-[#1a1a1a]">No cohort</option>
                    {cohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id} className="bg-[#1a1a1a]">{cohort.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={handleAssignCohort} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition">
                      Save
                    </button>
                    <button onClick={() => setShowAssignCohort(false)} className="px-4 py-2 rounded-lg border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : employeeCohorts.length > 0 ? (
                <div className="space-y-2">
                  {employeeCohorts.map((cohort) => (
                    <div key={cohort.id} className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                      <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center">
                        <Users className="text-white/50" size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{cohort.name}</p>
                        {cohort.description && <p className="text-xs text-white/40">{cohort.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-white/5 border border-white/5 text-center">
                  <Users className="mx-auto mb-2 text-white/20" size={24} />
                  <p className="text-sm text-white/40">Not assigned to any cohort</p>
                  <button
                    onClick={() => { setSelectedCohortId(''); setShowAssignCohort(true); }}
                    className="mt-2 text-xs text-white/50 hover:text-white transition"
                  >
                    Assign to cohort
                  </button>
                </div>
              )}
            </div>

            {/* Danger Zone */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-400/60 mb-4">Danger Zone</p>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Delete Employee</p>
                    <p className="text-xs text-white/40">Permanently remove this employee and all their data</p>
                  </div>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition"
                  >
                    Delete
                  </button>
                </div>
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
      <div className="p-6 md:p-10 min-h-[calc(100vh-140px)]">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-5 w-36" />
          <div className="flex gap-6">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 md:p-10 min-h-[calc(100vh-140px)]">
        <div className="max-w-6xl mx-auto space-y-6">
          <button onClick={() => navigate('/admin/employees')} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition">
            <ArrowLeft size={16} /> Back to Employees
          </button>
          <div className="p-12 rounded-xl bg-white/5 border border-white/5 text-center">
            <UserCircle className="h-16 w-16 text-white/20 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Employee Not Found</h2>
            <p className="text-white/40">The employee you're looking for doesn't exist or has been removed.</p>
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
          onClick={() => navigate('/admin/employees')}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition mb-6 w-fit"
        >
          <ArrowLeft size={16} /> Back to Employees
        </button>

        {/* Header */}
        <div className="flex flex-wrap items-start gap-6 mb-8">
          <Avatar
            src={employee.avatar}
            name={employee.name}
            email={employee.email}
            size="xxl"
            className="h-20 w-20 rounded-2xl border-4 border-[#050608] shadow-lg text-2xl shrink-0"
          />
          <div className="flex-1 min-w-[240px] space-y-2">
            <h1 className="text-2xl font-semibold text-white">{employee.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
              <span className="flex items-center gap-1.5"><Mail size={14} /> {employee.email}</span>
              {employee.department && <span className="flex items-center gap-1.5"><Building2 size={14} /> {employee.department}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
                employee.status === 'active' ? 'border-white/10 bg-white/5 text-white/70' : 'border-white/10 bg-white/5 text-white/40'
              }`}>
                <div className={`h-1.5 w-1.5 rounded-full ${employee.status === 'active' ? 'bg-emerald-400' : 'bg-white/30'}`} />
                {employee.status === 'active' ? 'Active' : 'Inactive'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/70 capitalize">
                <User size={12} /> {employee.role}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/70">
                <Calendar size={12} /> Joined {formatDate(employee.createdAt)}
              </span>

              {/* Actions Menu */}
              <div className="relative" ref={actionsMenuRef}>
                <button
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white transition"
                >
                  <MoreHorizontal size={14} />
                </button>

              {showActionsMenu && (
                <div className="absolute top-full left-0 mt-1 w-56 rounded-xl bg-[#1a1a1a] border border-white/10 shadow-2xl z-50 overflow-hidden">
                  <div className="p-1">
                    {/* Email */}
                    <a
                      href={`mailto:${employee.email}`}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-white/70 hover:bg-white/5 hover:text-white transition"
                      onClick={() => setShowActionsMenu(false)}
                    >
                      <Send size={14} />
                      Send Email
                    </a>

                    {/* Assign Cohort */}
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        setShowCohortSidebar(true);
                        setSelectedCohortId(employeeCohorts[0]?.id || 'none');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-white/70 hover:bg-white/5 hover:text-white transition"
                    >
                      <Users size={14} />
                      Assign Cohort
                    </button>

                    {/* Change Department */}
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        setShowDeptSidebar(true);
                        setNewDepartment(employee.department || '');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-white/70 hover:bg-white/5 hover:text-white transition"
                    >
                      <Building2 size={14} />
                      Change Department
                    </button>

                    {/* Change Role */}
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        setShowRoleModal(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-white/70 hover:bg-white/5 hover:text-white transition"
                    >
                      <Shield size={14} />
                      Change Role
                    </button>

                    <div className="my-1 border-t border-white/5" />

                    {/* Delete */}
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        setShowDeleteModal(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition"
                    >
                      <Trash2 size={14} />
                      Delete Employee
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
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
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'
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

      {/* Cohort Modal */}
      {showCohortSidebar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-zoom-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-dark-text">
                {isCreatingCohort ? 'Create New Cohort' : 'Assign to Cohort'}
              </h2>
              <button
                onClick={() => { setShowCohortSidebar(false); setIsCreatingCohort(false); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-dark-bg transition-colors"
              >
                <X size={18} className="text-dark-text-muted" />
              </button>
            </div>

            {isCreatingCohort ? (
              <>
                <p className="text-sm text-dark-text-muted mb-4">
                  Create a new cohort and assign {employee.name} to it:
                </p>
                <input
                  type="text"
                  value={newCohortName}
                  onChange={(e) => setNewCohortName(e.target.value)}
                  placeholder="Cohort name"
                  className="w-full h-10 rounded-xl border border-dark-border bg-dark-bg px-4 text-sm text-dark-text placeholder-dark-text-muted focus:border-primary focus:outline-none mb-4"
                  autoFocus
                />
                <div className="flex gap-3 pt-4 border-t border-dark-border">
                  <button
                    onClick={() => { setIsCreatingCohort(false); setNewCohortName(''); }}
                    className="flex-1 h-10 rounded-lg border border-dark-border bg-dark-bg text-sm font-medium text-dark-text transition hover:bg-dark-card"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      if (!newCohortName.trim() || !user?.organization) return;
                      try {
                        const cohortId = await createCohort(newCohortName.trim(), undefined, [employee.id], user.organization);
                        for (const c of employeeCohorts) {
                          await removeEmployeeFromCohort(c.id, employee.id);
                        }
                        await updateUserCohorts(employee.id, [cohortId]);
                        const newCohort: Cohort = { id: cohortId, name: newCohortName.trim(), employeeIds: [employee.id], createdAt: new Date() };
                        setCohorts([...cohorts, newCohort]);
                        setEmployeeCohorts([newCohort]);
                        setEmployee({ ...employee, cohortIds: [cohortId] });
                        setShowCohortSidebar(false);
                        setIsCreatingCohort(false);
                        setNewCohortName('');
                      } catch (error) {
                        console.error('Failed to create cohort:', error);
                      }
                    }}
                    disabled={!newCohortName.trim()}
                    className="flex-1 h-10 rounded-lg bg-primary text-white text-sm font-medium transition hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create & Assign
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {/* Create New Option */}
                  <button
                    onClick={() => { setIsCreatingCohort(true); setNewCohortName(''); }}
                    className="w-full p-4 border border-dashed border-dark-border rounded-xl hover:bg-dark-bg transition-colors text-left flex items-center gap-3"
                  >
                    <Plus size={16} className="text-dark-text-muted" />
                    <div className="font-medium text-dark-text">Create new cohort</div>
                  </button>

                  {/* No Cohort Option */}
                  <button
                    onClick={async () => {
                      for (const cohort of employeeCohorts) {
                        await removeEmployeeFromCohort(cohort.id, employee.id);
                      }
                      await updateUserCohorts(employee.id, []);
                      setEmployeeCohorts([]);
                      setEmployee({ ...employee, cohortIds: undefined });
                      setShowCohortSidebar(false);
                    }}
                    className={`w-full p-4 border rounded-xl transition-colors text-left ${
                      employeeCohorts.length === 0
                        ? 'border-primary bg-primary/10'
                        : 'border-dark-border hover:bg-dark-bg'
                    }`}
                  >
                    <div className="font-medium text-dark-text">Unassigned</div>
                    <div className="text-sm text-dark-text-muted">Remove from all cohorts</div>
                  </button>

                  {/* Existing Cohorts */}
                  {cohorts.map((cohort) => (
                    <button
                      key={cohort.id}
                      onClick={async () => {
                        for (const c of employeeCohorts) {
                          await removeEmployeeFromCohort(c.id, employee.id);
                        }
                        await addEmployeeToCohort(cohort.id, employee.id);
                        await updateUserCohorts(employee.id, [cohort.id]);
                        setEmployeeCohorts([cohort]);
                        setEmployee({ ...employee, cohortIds: [cohort.id] });
                        setShowCohortSidebar(false);
                      }}
                      className={`w-full p-4 border rounded-xl transition-colors text-left ${
                        employeeCohorts[0]?.id === cohort.id
                          ? 'border-primary bg-primary/10'
                          : 'border-dark-border hover:bg-dark-bg'
                      }`}
                    >
                      <div className="font-medium text-dark-text">{cohort.name}</div>
                      {cohort.description && (
                        <div className="text-sm text-dark-text-muted">{cohort.description}</div>
                      )}
                      <div className="text-xs text-dark-text-muted mt-1">
                        {cohort.employeeIds.length} employee{cohort.employeeIds.length !== 1 ? 's' : ''}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="pt-4 mt-4 border-t border-dark-border">
                  <button
                    onClick={() => setShowCohortSidebar(false)}
                    className="w-full h-10 rounded-lg border border-dark-border bg-dark-bg text-sm font-medium text-dark-text transition hover:bg-dark-card"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Department Modal */}
      {showDeptSidebar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-zoom-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-dark-text">
                {isCreatingDept ? 'Create New Department' : 'Change Department'}
              </h2>
              <button
                onClick={() => { setShowDeptSidebar(false); setIsCreatingDept(false); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-dark-bg transition-colors"
              >
                <X size={18} className="text-dark-text-muted" />
              </button>
            </div>

            {isCreatingDept ? (
              <>
                <p className="text-sm text-dark-text-muted mb-4">
                  Create a new department and assign {employee.name} to it:
                </p>
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="Department name"
                  className="w-full h-10 rounded-xl border border-dark-border bg-dark-bg px-4 text-sm text-dark-text placeholder-dark-text-muted focus:border-primary focus:outline-none mb-4"
                  autoFocus
                />
                <div className="flex gap-3 pt-4 border-t border-dark-border">
                  <button
                    onClick={() => { setIsCreatingDept(false); setNewDepartment(''); }}
                    className="flex-1 h-10 rounded-lg border border-dark-border bg-dark-bg text-sm font-medium text-dark-text transition hover:bg-dark-card"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      if (!newDepartment.trim()) return;
                      try {
                        await upsertUserProfile(employee.id, { department: newDepartment.trim() });
                        setEmployee({ ...employee, department: newDepartment.trim() });
                        if (!existingDepartments.includes(newDepartment.trim())) {
                          setExistingDepartments([...existingDepartments, newDepartment.trim()].sort());
                        }
                        setShowDeptSidebar(false);
                        setIsCreatingDept(false);
                        setNewDepartment('');
                      } catch (error) {
                        console.error('Failed to update department:', error);
                      }
                    }}
                    disabled={!newDepartment.trim()}
                    className="flex-1 h-10 rounded-lg bg-primary text-white text-sm font-medium transition hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create & Assign
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {/* Create New Option */}
                  <button
                    onClick={() => { setIsCreatingDept(true); setNewDepartment(''); }}
                    className="w-full p-4 border border-dashed border-dark-border rounded-xl hover:bg-dark-bg transition-colors text-left flex items-center gap-3"
                  >
                    <Plus size={16} className="text-dark-text-muted" />
                    <div className="font-medium text-dark-text">Create new department</div>
                  </button>

                  {/* No Department Option */}
                  <button
                    onClick={async () => {
                      try {
                        await upsertUserProfile(employee.id, { department: null });
                        setEmployee({ ...employee, department: undefined });
                        setShowDeptSidebar(false);
                      } catch (error) {
                        console.error('Failed to update department:', error);
                      }
                    }}
                    className={`w-full p-4 border rounded-xl transition-colors text-left ${
                      !employee.department
                        ? 'border-primary bg-primary/10'
                        : 'border-dark-border hover:bg-dark-bg'
                    }`}
                  >
                    <div className="font-medium text-dark-text">Unassigned</div>
                    <div className="text-sm text-dark-text-muted">Remove from department</div>
                  </button>

                  {/* Existing Departments */}
                  {existingDepartments.map((dept) => (
                    <button
                      key={dept}
                      onClick={async () => {
                        try {
                          await upsertUserProfile(employee.id, { department: dept });
                          setEmployee({ ...employee, department: dept });
                          setShowDeptSidebar(false);
                        } catch (error) {
                          console.error('Failed to update department:', error);
                        }
                      }}
                      className={`w-full p-4 border rounded-xl transition-colors text-left ${
                        employee.department === dept
                          ? 'border-primary bg-primary/10'
                          : 'border-dark-border hover:bg-dark-bg'
                      }`}
                    >
                      <div className="font-medium text-dark-text">{dept}</div>
                    </button>
                  ))}
                </div>
                <div className="pt-4 mt-4 border-t border-dark-border">
                  <button
                    onClick={() => setShowDeptSidebar(false)}
                    className="w-full h-10 rounded-lg border border-dark-border bg-dark-bg text-sm font-medium text-dark-text transition hover:bg-dark-card"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-zoom-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="text-red-400" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-dark-text">Delete Employee</h3>
                <p className="text-sm text-dark-text-muted">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-dark-text-muted mb-6">
              Are you sure you want to delete <span className="font-medium text-dark-text">{employee?.name}</span>?
              All their data, progress, and enrollments will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-dark-border text-dark-text-muted text-sm font-medium hover:bg-dark-border/50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEmployee}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Employee'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {showRoleModal && employee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-zoom-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-dark-text">Change Role</h2>
              <button
                onClick={() => setShowRoleModal(false)}
                disabled={isUpdatingRole}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-dark-bg transition-colors disabled:opacity-50"
              >
                <X size={18} className="text-dark-text-muted" />
              </button>
            </div>
            <p className="text-sm text-dark-text-muted mb-4">
              Select a new role for <span className="text-dark-text font-medium">{employee.name}</span>
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleRoleChange('employee')}
                disabled={isUpdatingRole}
                className={`w-full p-4 border rounded-xl transition-colors text-left ${
                  employee.role === 'employee'
                    ? 'border-primary bg-primary/10'
                    : 'border-dark-border hover:bg-dark-bg'
                } disabled:opacity-50`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="font-medium text-dark-text">Employee</div>
                    <div className="text-sm text-dark-text-muted">Standard access to campaigns and learning content</div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handleRoleChange('admin')}
                disabled={isUpdatingRole || employee.id === user?.id}
                className={`w-full p-4 border rounded-xl transition-colors text-left ${
                  employee.role === 'admin'
                    ? 'border-primary bg-primary/10'
                    : 'border-dark-border hover:bg-dark-bg'
                } disabled:opacity-50`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="font-medium text-dark-text">Admin</div>
                    <div className="text-sm text-dark-text-muted">Full access to manage employees, campaigns, and settings</div>
                  </div>
                </div>
                {employee.id === user?.id && (
                  <p className="text-xs text-amber-400 mt-2">You cannot change your own role</p>
                )}
              </button>
            </div>
            <div className="pt-4 mt-4 border-t border-dark-border">
              <button
                onClick={() => setShowRoleModal(false)}
                disabled={isUpdatingRole}
                className="w-full h-10 rounded-lg border border-dark-border bg-dark-bg text-sm font-medium text-dark-text transition hover:bg-dark-card disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDetail;
